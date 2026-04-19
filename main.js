const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { program } = require('commander');
const superagent = require('superagent');

program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <cache>', 'Шлях до директорії кешу');

program.parse();
const options = program.opts();

async function initCache() {
  try {
    await fs.access(options.cache);
  } catch {
    await fs.mkdir(options.cache, { recursive: true });
    console.log(`Директорію створено: ${options.cache}`);
  }
}

const server = http.createServer(async (req, res) => {
  const statusCode = req.url.substring(1);

  if (!/^\d+$/.test(statusCode)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request');
  }

  const filePath = path.join(options.cache, `${statusCode}.jpg`);

  try {
    switch (req.method) {
      case 'GET':
        try {
          const image = await fs.readFile(filePath);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(image);
        } catch (err) {
          try {
            const catUrl = `https://http.cat/${statusCode}`;
            const catResponse = await superagent.get(catUrl);
            
            await fs.writeFile(filePath, catResponse.body);
            
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            res.end(catResponse.body);
          } catch (superagentErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          }
        }
        break;

      case 'PUT':
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        
        req.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            await fs.writeFile(filePath, buffer);
            res.writeHead(201, { 'Content-Type': 'text/plain' });
            res.end('Created');
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
          }
        });
        break;

      case 'DELETE':
        try {
          await fs.unlink(filePath);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Deleted');
        } catch (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
        break;

      default:
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        break;
    }
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Critical Server Error');
  }
});

initCache().then(() => {
  server.listen(options.port, options.host, () => {
    console.log(`Сервер працює на http://${options.host}:${options.port}`);
  });
});