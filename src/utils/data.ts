import * as fs from 'fs';
import * as path from 'path';
import {createWriteStream} from 'fs';
import {pipeline} from 'stream/promises';
import {Readable} from 'stream';
import {x as tarExtract} from 'tar';
import YAML from 'yaml';
import Fuse from 'fuse.js';
import type {Dataset} from '../tools/schemas.js';

const REPO_DOWNLOAD_URL = 'https://github.com/awslabs/open-data-registry/archive/refs/heads/main.tar.gz';
const CACHE_DIR = path.join(import.meta.dirname, '../../.cache');
const DATASETS_DIR = path.join(CACHE_DIR, 'open-data-registry-main/datasets');

async function ensureRepoDownloaded(): Promise<void> {
  if (fs.existsSync(DATASETS_DIR)) {
    return;
  }

  console.log('Downloading AWS Open Data Registry (this will only happen once)...');
  fs.mkdirSync(CACHE_DIR, {recursive: true});

  const tarPath = path.join(CACHE_DIR, 'repo.tar.gz');

  const response = await fetch(REPO_DOWNLOAD_URL);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const fileStream = createWriteStream(tarPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeStream = Readable.fromWeb(response.body as any);
  await pipeline(nodeStream, fileStream);

  await tarExtract({
    file: tarPath,
    cwd: CACHE_DIR,
  });

  fs.unlinkSync(tarPath);

  console.log('Repository downloaded and extracted successfully');
}

async function getDatasetList(): Promise<string[]> {
  await ensureRepoDownloaded();
  const files = fs.readdirSync(DATASETS_DIR);
  return files.filter(f => f.endsWith('.yaml'));
}

export async function getDataset(id: string): Promise<Dataset> {
  await ensureRepoDownloaded();
  const filename = `${id}.yaml`;
  const filePath = path.join(DATASETS_DIR, filename);
  const yamlContent = fs.readFileSync(filePath, 'utf-8');
  return {...YAML.parse(yamlContent), id} as Dataset;
}

export async function searchDatasets(query: string, limit: number): Promise<Dataset[]> {
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
      {name: 'Name', weight: 2.5},
      {name: 'Description', weight: 2},
      {name: 'Tags', weight: 2},
    ],
    threshold: 0.6,
    ignoreLocation: true,
  });

  return fuse.search(query).slice(0, limit).map(result => result.item);
}
