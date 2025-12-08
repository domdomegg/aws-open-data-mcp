import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerSearchDatasets} from './search-datasets.js';
import {registerGetDataset} from './get-dataset.js';

export function registerAll(server: McpServer): void {
  registerSearchDatasets(server);
  registerGetDataset(server);
}
