const path = require('node:path');
const fs = require('node:fs/promises');
const http = require('node:http');

const unified = require('unified');
const remark = require('remark-parse');

const gfm = require('remark-gfm');
const gemoji = require('remark-gemoji');
const a11yEmoji = require('@fec/remark-a11y-emoji');
const hljs = require('rehype-highlight')
const unwrapimages = require('remark-unwrap-images');

const rehype = require('remark-rehype');
const stringify = require('rehype-stringify')

const convert = async (markdown) => await unified()
	.use(remark)
	.use(gfm)
	.use(gemoji)
	.use(a11yEmoji)
	.use(unwrapimages)
	.use(rehype)
	.use(hljs, { detect: true })
	.use(stringify)
	.process(markdown);

const express = require('express');
const app = express();
const server = http.createServer(app);

app.locals.TITLE = `New Note by @${process.env.REPL_OWNER}`;
app.locals.OWNER = process.env.REPL_OWNER;
const README = path.join(__dirname, 'README.md');

const dirs = {
	static: path.join(__dirname, 'public'),
	views: path.join(__dirname, 'views'),
};

const hbs = require('hbs');
app.set('view engine', 'html');
app.set('views', dirs.views)
app.engine('html', hbs.__express);
hbs.localsAsTemplateData(app);

app.use(express.static(dirs.static));

app.get('*', async (req, res) => {
	const markdown = await fs.readFile(README, 'utf8');
	const html = await convert(markdown);

	res.render('index', { MARKDOWN: html });
});

const WebSocketServer = require('ws');
const wss = new WebSocketServer.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const chokidar = require('chokidar');
chokidar.watch(__dirname).on('all', async (event, path) => {
	if(event === 'change' && path === README) {
		const markdown = await fs.readFile(README, 'utf8');
		const html = await convert(markdown);
		for (const client of wss.clients) client.send(String(html));
	}
});

server.listen(3000);
