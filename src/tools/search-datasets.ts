import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {datasetSchema, minimalDatasetSchema} from './schemas.js';
import {jsonResult} from '../utils/response.js';
import {searchDatasets} from '../utils/data.js';

const searchOutputSchema = z.object({
  results: z.union([
    z.array(z.string()),
    z.array(minimalDatasetSchema),
    z.array(datasetSchema),
  ]),
});

export function registerSearchDatasets(server: McpServer): void {
  server.registerTool(
    'search_datasets',
    {
      title: 'Search Datasets',
      description: 'Search for datasets in the AWS Open Data Registry. If no query is provided, lists all datasets. Returns datasets matching the search query in their name, description, or tags.',
      inputSchema: {
        query: z.string().optional().default('').describe('Search query to match against dataset names, descriptions, and tags. Empty query returns all datasets.'),
        limit: z.number().optional().default(25).describe('Maximum number of results to return'),
        detail: z.enum(['nameOnly', 'minimal', 'full']).optional().default('minimal').describe("Detail level: 'nameOnly' (just names), 'minimal' (name and description), or 'full' (complete dataset info). Start with just 'nameOnly' or 'minimal', and only use 'full' to expand results once you know there are only a few matches."),
      },
      outputSchema: searchOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({query, limit, detail}) => {
      const datasets = await searchDatasets(query, limit);

      let results: z.infer<typeof searchOutputSchema>['results'];
      if (detail === 'nameOnly') {
        results = datasets.map(d => d.Name);
      } else if (detail === 'minimal') {
        results = datasets.map(d => ({id: d.id, Name: d.Name, Description: d.Description}));
      } else {
        results = datasets;
      }

      return jsonResult(searchOutputSchema.parse({results}));
    },
  );
}
