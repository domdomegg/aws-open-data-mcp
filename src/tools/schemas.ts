import {z} from 'zod';

export const datasetSchema = z.object({
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

export type Dataset = z.infer<typeof datasetSchema>;

export const minimalDatasetSchema = z.object({
  id: z.string(),
  Name: z.string(),
  Description: z.string(),
});
