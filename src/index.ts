import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import YAML from "yaml";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { x as tarExtract } from "tar";
import { z } from "zod";
import Fuse from "fuse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Dataset {
  id: string;
  Name: string;
  Description: string;
  Documentation?: string;
  Contact?: string;
  ManagedBy?: string;
  UpdateFrequency?: string;
  Tags?: string[];
  License?: string;
  Resources?: {
    Description?: string;
    ARN?: string;
    Region?: string;
    Type?: string;
  }[];
}

const REPO_DOWNLOAD_URL = "https://github.com/awslabs/open-data-registry/archive/refs/heads/main.tar.gz";
const CACHE_DIR = path.join(__dirname, "../.cache");
const DATASETS_DIR = path.join(CACHE_DIR, "open-data-registry-main/datasets");

async function ensureRepoDownloaded(): Promise<void> {
  if (fs.existsSync(DATASETS_DIR)) {
    return;
  }

  console.log("Downloading AWS Open Data Registry (this will only happen once)...");
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const tarPath = path.join(CACHE_DIR, "repo.tar.gz");

  const response = await fetch(REPO_DOWNLOAD_URL);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const fileStream = createWriteStream(tarPath);
  await pipeline(response.body as any, fileStream);

  await tarExtract({
    file: tarPath,
    cwd: CACHE_DIR,
  });

  fs.unlinkSync(tarPath);

  console.log("Repository downloaded and extracted successfully");
}

async function getDatasetList(): Promise<string[]> {
  await ensureRepoDownloaded();
  const files = fs.readdirSync(DATASETS_DIR);
  return files.filter(f => f.endsWith('.yaml'));
}

async function getDataset(id: string): Promise<Dataset> {
  await ensureRepoDownloaded();
  const filename = `${id}.yaml`;
  const filePath = path.join(DATASETS_DIR, filename);
  const yamlContent = fs.readFileSync(filePath, 'utf-8');
  return { ...YAML.parse(yamlContent), id } as Dataset;
}

type DetailLevel = 'nameOnly' | 'minimal' | 'full';

async function searchDatasets(
  query: string,
  limit: number,
  detail: DetailLevel
): Promise<string[] | {Name: string, Description: string, id: string}[] | Dataset[]> {
  const datasetFiles = await getDatasetList();
  const datasetsWithIds: Dataset[] = [];

  for (const file of datasetFiles) {
    try {
      const id = file.replace(/\.yaml$/, '');
      const dataset = await getDataset(id);
      datasetsWithIds.push(dataset);
    } catch (error) {
      console.error(`Error reading dataset ${file}:`, error);
    }
  }

  let results: Dataset[];

  if (!query) {
    results = datasetsWithIds.slice(0, limit);
  } else {
    const fuse = new Fuse(datasetsWithIds, {
      keys: [
        { name: 'Name', weight: 2.5 },
        { name: 'Description', weight: 2 },
        { name: 'Tags', weight: 2 }
      ],
      threshold: 0.6,
      ignoreLocation: true,
      findAllMatches: true,
      useExtendedSearch: false,
      shouldSort: true,
    });

    const searchResults = fuse.search(query);

    results = searchResults.slice(0, limit).map(result => result.item);
  }

  if (detail === 'nameOnly') {
    return results.map(d => d.Name);
  } else if (detail === 'minimal') {
    return results.map(d => ({ Name: d.Name, Description: d.Description, id: d.id }));
  } else {
    return results;
  }
}

const server = new McpServer({
  name: "aws-open-data-mcp",
  version: "1.0.0",
});

server.tool(
  "search_datasets",
  "Search for datasets in the AWS Open Data Registry. If no query is provided, lists all datasets. Returns datasets matching the search query in their name, description, or tags.",
  {
    query: z.string().optional().default("").describe("Search query to match against dataset names, descriptions, and tags. Empty query returns all datasets."),
    limit: z.number().optional().default(25).describe("Maximum number of results to return"),
    detail: z.enum(['nameOnly', 'minimal', 'full']).optional().default('minimal').describe("Detail level: 'nameOnly' (just names), 'minimal' (name and description), or 'full' (complete dataset info). Start with just 'nameOnly' or 'minimal', and only use 'full' to expand results once you know there are only a few matches."),
  },
  async ({ query, limit, detail }) => {
    const results = await searchDatasets(query, limit, detail);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_dataset",
  "Get detailed information about a specific dataset by its ID (e.g., 'sentinel-1')",
  {
    id: z.string().describe("The ID of the dataset (without .yaml extension)"),
  },
  async ({ id }) => {
    const dataset = await getDataset(id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(dataset, null, 2),
        },
      ],
    };
  }
);

async function runHttp(port: number = 3000) {
  const app = express();
  app.use(express.json());

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  app.post("/mcp", async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, () => {
    console.log(`AWS Open Data MCP Server running on http://localhost:${port}/mcp`);
  });
}

const port = parseInt(process.env.PORT || "3000");
runHttp(port);