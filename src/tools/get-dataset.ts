import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {datasetSchema} from './schemas.js';
import {jsonResult} from '../utils/response.js';
import {getDataset} from '../utils/data.js';

const getDatasetOutputSchema = z.object({
  dataset: datasetSchema,
});

export function registerGetDataset(server: McpServer): void {
  server.registerTool(
    'get_dataset',
    {
      title: 'Get Dataset',
      description: "Get detailed information about a specific dataset by its ID (e.g., 'sentinel-1')",
      inputSchema: {
        id: z.string().describe('The ID of the dataset (without .yaml extension)'),
      },
      outputSchema: getDatasetOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({id}) => {
      const dataset = await getDataset(id);
      return jsonResult(getDatasetOutputSchema.parse({dataset}));
    },
  );
}
