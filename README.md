# AWS Open Data Registry MCP Server

An MCP server that allows searching and exploring datasets from the [AWS Open Data Registry](https://github.com/awslabs/open-data-registry).

## Features

- **search_datasets**: Search for datasets by name, description, or tags with fuzzy matching
- **get_dataset**: Get detailed information about a specific dataset
- Automatic caching of the AWS Open Data Registry for fast lookups

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

The server will be available at `http://localhost:3000/mcp` using the streamable HTTP transport. You can install this in Claude Code with: `claude mcp add aws-open-data --transport http http://localhost:3000/mcp`. You'll then need to restart Claude Code to pick up the new MCP.

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
- `filename` (string, required): The filename of the dataset (must end with .yaml)

**Example:**
```json
{
  "filename": "sentinel-1.yaml"
}
```
