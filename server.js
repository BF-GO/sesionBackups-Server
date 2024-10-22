const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = 3333;
const AUTO_SAVE_PATH = path.join(__dirname, 'sessions', 'auto');
const CHANGE_SAVE_PATH = path.join(__dirname, 'sessions', 'change');
const MAX_SESSIONS = 5;

app.use(cors());
app.use(express.json());

// Создаем папки для сохранения сессий, если они не существуют
if (!fs.existsSync(AUTO_SAVE_PATH)) {
	fs.mkdirSync(AUTO_SAVE_PATH, { recursive: true });
}
if (!fs.existsSync(CHANGE_SAVE_PATH)) {
	fs.mkdirSync(CHANGE_SAVE_PATH, { recursive: true });
}

// Функция для управления количеством сессий (храним последние 5 сессий)
function manageSessionLimit(folderPath) {
	const files = fs.readdirSync(folderPath).sort((a, b) => {
		return (
			fs.statSync(path.join(folderPath, a)).mtimeMs -
			fs.statSync(path.join(folderPath, b)).mtimeMs
		);
	});

	if (files.length > MAX_SESSIONS) {
		const filesToDelete = files.slice(0, files.length - MAX_SESSIONS);
		filesToDelete.forEach((file) => fs.unlinkSync(path.join(folderPath, file)));
	}
}

// Маршрут для сохранения автоматической сессии
app.post('/save-auto-session', (req, res) => {
	const sessionData = req.body;
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filePath = path.join(AUTO_SAVE_PATH, `auto-session-${timestamp}.json`);

	fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), (err) => {
		if (err) {
			return res.status(500).send('Error saving auto session');
		}

		manageSessionLimit(AUTO_SAVE_PATH);
		res.send('Auto session saved successfully');
	});
});

// Маршрут для сохранения сессии при изменении вкладок
app.post('/save-change-session', (req, res) => {
	const sessionData = req.body;
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filePath = path.join(
		CHANGE_SAVE_PATH,
		`change-session-${timestamp}.json`
	);

	fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), (err) => {
		if (err) {
			return res.status(500).send('Error saving change session');
		}

		manageSessionLimit(CHANGE_SAVE_PATH);
		res.send('Change session saved successfully');
	});
});

// Маршрут для получения автоматических сессий
app.get('/get-auto-sessions', (req, res) => {
	const files = fs.readdirSync(AUTO_SAVE_PATH).sort((a, b) => {
		return (
			fs.statSync(path.join(AUTO_SAVE_PATH, b)).mtimeMs -
			fs.statSync(path.join(AUTO_SAVE_PATH, a)).mtimeMs
		);
	});

	const sessions = files.slice(0, MAX_SESSIONS).map((file) => ({
		name: file,
		path: path.join(AUTO_SAVE_PATH, file),
		timestamp: file
			.replace('auto-session-', '')
			.replace('.json', '')
			.replace(/-/g, ':'),
	}));

	res.json(sessions);
});

// Маршрут для получения сессий, сохранённых при изменении вкладок
app.get('/get-change-sessions', (req, res) => {
	const files = fs.readdirSync(CHANGE_SAVE_PATH).sort((a, b) => {
		return (
			fs.statSync(path.join(CHANGE_SAVE_PATH, b)).mtimeMs -
			fs.statSync(path.join(CHANGE_SAVE_PATH, a)).mtimeMs
		);
	});

	const sessions = files.slice(0, MAX_SESSIONS).map((file) => ({
		name: file,
		path: path.join(CHANGE_SAVE_PATH, file),
		timestamp: file
			.replace('change-session-', '')
			.replace('.json', '')
			.replace(/-/g, ':'),
	}));

	res.json(sessions);
});

// Маршрут для получения содержимого сессии (файл с сессией)
app.get('/get-session-content', (req, res) => {
	const file = req.query.file;

	if (!file) {
		return res.status(400).send('File path is required');
	}

	const folderPath = path.dirname(file);
	const fileName = path.basename(file);
	let filePath;

	// Определяем, к какому типу сессии относится файл
	if (folderPath.endsWith('auto')) {
		filePath = path.join(AUTO_SAVE_PATH, fileName);
	} else if (folderPath.endsWith('change')) {
		filePath = path.join(CHANGE_SAVE_PATH, fileName);
	} else {
		return res.status(400).send('Invalid session folder');
	}

	// Читаем содержимое файла сессии
	fs.readFile(filePath, 'utf8', (err, data) => {
		if (err) {
			return res.status(500).send('Error reading session file');
		}

		try {
			const sessionData = JSON.parse(data);
			res.json(sessionData); // Отправляем JSON сессии клиенту
		} catch (err) {
			res.status(500).send('Invalid session file format');
		}
	});
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
