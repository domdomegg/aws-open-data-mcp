# AWS Open Data Registry MCP Server

An MCP server that allows searching and exploring datasets from the [AWS Open Data Registry](https://github.com/awslabs/open-data-registry).

## Features

- **search_datasets**: Search for datasets by name, description, or tags with fuzzy matching
- **get_dataset**: Get detailed information about a specific dataset
- Automatic caching of the AWS Open Data Registry for fast lookups

## Installation

```bash
npm install
npm run build
```

## Usage

### stdio transport (default)

```bash
npm start
```

This runs the server with stdio transport, suitable for use with Claude Desktop or other MCP clients that support stdio.

### HTTP transport

```bash
npm run start:http
```

The server will be available at `http://localhost:3000/mcp`. You can customize the port with the `PORT` environment variable.

## Development

```bash
npm run dev        # Run with tsx (stdio)
npm run dev:http   # Run with tsx (HTTP)
```

## Tools

### search_datasets

Search for datasets matching a query. If no query is provided, returns all datasets.

**Arguments:**
- `query` (string, optional): Search query to match against dataset names, descriptions, and tags. Empty query returns all datasets
- `limit` (number, optional): Maximum number of results to return (default: 25)
- `detail` (enum, optional): Detail level - 'nameOnly' (just names), 'minimal' (name and description), or 'full' (complete dataset info). Default: 'minimal'

**Example:**
```json
{
  "query": "satellite",
  "limit": 5,
  "detail": "minimal"
}
```

### get_dataset

Get detailed information about a specific dataset.

**Arguments:**
- `id` (string, required): The ID of the dataset (without .yaml extension)

**Example:**
```json
{
  "id": "sentinel-1"
}
```
