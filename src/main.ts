import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import {initServer, setupSignalHandlers, handleStartupError} from './transports/shared.js';

const transport = process.env.MCP_TRANSPORT || 'stdio';

async function runStdio() {
  const server = initServer();
  const stdioTransport = new StdioServerTransport();

  setupSignalHandlers(async () => {
    await server.close();
  });

  await server.connect(stdioTransport);
}

async function runHttp(port: number) {
  const server = initServer();
  const app = express();
  app.use(express.json());

  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(httpTransport);

  app.post('/mcp', async (req, res) => {
    await httpTransport.handleRequest(req, res, req.body);
  });

  const httpServer = app.listen(port, () => {
    console.log(`AWS Open Data MCP Server running on http://localhost:${port}/mcp`);
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });

  setupSignalHandlers(async () => {
    httpServer.close();
    await server.close();
  });
}

async function main() {
  if (transport === 'stdio') {
    await runStdio();
  } else if (transport === 'http') {
    const port = parseInt(process.env.PORT || '3000', 10);
    await runHttp(port);
  } else {
    console.error(`Unknown transport: ${transport}. Use 'stdio' or 'http'.`);
    process.exit(1);
  }
}

main().catch(handleStartupError);
