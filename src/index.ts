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

const datasetSchema = z.object({
  id: z.string(),
  Name: z.string(),
  Description: z.string(),
  Documentation: z.string().optional(),
  Contact: z.string().optional(),
  ManagedBy: z.string().optional(),
  UpdateFrequency: z.string().optional(),
  Tags: z.array(z.string()).optional(),
  License: z.string().optional(),
  Resources: z.array(z.object({
    Description: z.string().optional(),
    ARN: z.string().optional(),
    Region: z.string().optional(),
    Type: z.string().optional(),
  })).optional(),
});

type Dataset = z.infer<typeof datasetSchema>;

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

async function searchDatasets(query: string, limit: number): Promise<Dataset[]> {
  const datasetFiles = await getDatasetList();
  const datasets: Dataset[] = [];

  for (const file of datasetFiles) {
    try {
      const id = file.replace(/\.yaml$/, '');
      const dataset = await getDataset(id);
      datasets.push(dataset);
    } catch (error) {
      console.error(`Error reading dataset ${file}:`, error);
    }
  }

  if (!query) {
    return datasets.slice(0, limit);
  }

  const fuse = new Fuse(datasets, {
    keys: [
      { name: 'Name', weight: 2.5 },
      { name: 'Description', weight: 2 },
      { name: 'Tags', weight: 2 }
    ],
    threshold: 0.6,
    ignoreLocation: true,
  });

  return fuse.search(query).slice(0, limit).map(result => result.item);
}

const server = new McpServer({
  name: "aws-open-data-mcp",
  version: "1.0.0",
});

server.registerTool(
  "search_datasets",
  {
    description: "Search for datasets in the AWS Open Data Registry. If no query is provided, lists all datasets. Returns datasets matching the search query in their name, description, or tags.",
    inputSchema: {
      query: z.string().optional().default("").describe("Search query to match against dataset names, descriptions, and tags. Empty query returns all datasets."),
      limit: z.number().optional().default(25).describe("Maximum number of results to return"),
      detail: z.enum(['nameOnly', 'minimal', 'full']).optional().default('minimal').describe("Detail level: 'nameOnly' (just names), 'minimal' (name and description), or 'full' (complete dataset info). Start with just 'nameOnly' or 'minimal', and only use 'full' to expand results once you know there are only a few matches."),
    },
    outputSchema: {
      results: z.union([
        z.array(z.string()),
        z.array(z.object({
          Name: z.string(),
          Description: z.string(),
          id: z.string(),
        })),
        z.array(datasetSchema),
      ]),
    },
  },
  async ({ query, limit, detail }) => {
    const datasets = await searchDatasets(query, limit);

    let results;
    if (detail === 'nameOnly') {
      results = datasets.map(d => d.Name);
    } else if (detail === 'minimal') {
      results = datasets.map(d => ({ id: d.id, Name: d.Name, Description: d.Description }));
    } else {
      results = datasets;
    }

    const output = { results };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(output),
        },
      ],
      structuredContent: output,
    };
  }
);

server.registerTool(
  "get_dataset",
  {
    description: "Get detailed information about a specific dataset by its ID (e.g., 'sentinel-1')",
    inputSchema: {
      id: z.string().describe("The ID of the dataset (without .yaml extension)"),
    },
    outputSchema: {
      dataset: datasetSchema,
    },
  },
  async ({ id }) => {
    const dataset = await getDataset(id);
    const output = { dataset };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(output),
        },
      ],
      structuredContent: output,
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

  const httpServer = app.listen(port, () => {
    console.log(`AWS Open Data MCP Server running on http://localhost:${port}/mcp`);
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} is already in use. Please use a different port or stop the process using port ${port}.`);
    } else {
      console.error(`Server error:`, err);
    }
    process.exit(1);
  });
}

const port = parseInt(process.env.PORT || "3000");
runHttp(port);