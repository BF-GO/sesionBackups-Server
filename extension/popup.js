// popup.js

// Функция для исправления формата временной метки
function fixTimestampFormat(timestamp) {
	// Заменяем двоеточия в дате на дефисы и форматируем миллисекунды
	const fixedTimestamp = timestamp
		.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3') // Заменяем формат даты с "YYYY:MM:DD" на "YYYY-MM-DD"
		.replace(/:(\d{3})Z$/, '.$1Z'); // Заменяем разделитель миллисекунд с двоеточия на точку
	return fixedTimestamp;
}

// Функция для преобразования временной метки в удобный формат
function formatTimestamp(timestamp) {
	// Исправляем формат временной метки
	const fixedTimestamp = fixTimestampFormat(timestamp);
	const date = new Date(fixedTimestamp);

	// Проверяем, корректно ли создана дата
	if (isNaN(date.getTime())) {
		console.error('Invalid date detected:', timestamp);
		return 'Invalid date';
	}

	// Форматируем дату и время для Европы (например, часовой пояс Европы)
	return date.toLocaleString('en-GB', {
		timeZone: 'Europe/Helsinki', // Указываем нужный часовой пояс
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

// Функция для загрузки сессий
async function loadSessions() {
	try {
		// Загрузка автоматических сессий
		const autoSessions = await fetchSessions('get-auto-sessions');
		populateSessionList('autoSessions', autoSessions);

		// Загрузка сессий, сохранённых при изменении вкладок
		const changeSessions = await fetchSessions('get-change-sessions');
		populateSessionList('changeSessions', changeSessions);
	} catch (error) {
		console.error('Error loading sessions:', error);
		showNotification('Error', 'Failed to load sessions.');
	}
}

// Функция для получения сессий с сервера
async function fetchSessions(endpoint) {
	const url = `http://localhost:3333/${endpoint}`;
	console.log(`Fetching sessions from: ${url}`);

	try {
		const response = await fetch(url);
		console.log(`Response status for ${endpoint}:`, response.status);

		if (!response.ok) {
			throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
		}

		const sessions = await response.json();
		console.log(`Fetched sessions for ${endpoint}:`, sessions);
		return sessions;
	} catch (error) {
		console.error(`Error fetching ${endpoint}:`, error);
		throw error; // Пробрасываем ошибку дальше
	}
}

// Функция для заполнения списка сессий
function populateSessionList(elementId, sessions) {
	const sessionList = document.getElementById(elementId);
	sessionList.innerHTML = `<h2>${
		elementId === 'autoSessions'
			? 'Automatic Sessions'
			: 'Change-Triggered Sessions'
	}</h2>`;

	if (sessions.length === 0) {
		sessionList.innerHTML += '<p>No sessions available</p>';
		return;
	}

	const fragment = document.createDocumentFragment();

	sessions.forEach((session) => {
		const sessionItem = document.createElement('div');
		sessionItem.className = 'session-item';
		sessionItem.innerHTML = `
          <div class="session-header">
              <span>${formatTimestamp(session.timestamp)}</span>
              <button class="button-small view-btn" data-path="${
								session.path
							}">View</button>
          </div>
          <div class="session-details" style="display: none;"></div>
      `;
		fragment.appendChild(sessionItem);
	});

	sessionList.appendChild(fragment);
}

// Функция для просмотра и скрытия деталей сессии
async function viewSessionDetails(filePath, button) {
	const detailsDiv = button.parentElement.nextElementSibling;
	if (detailsDiv.style.display === 'block') {
		detailsDiv.style.display = 'none';
		button.textContent = 'View';
		return;
	}

	try {
		const response = await fetch(
			`http://localhost:3333/get-session-content?file=${encodeURIComponent(
				filePath
			)}`
		);
		if (!response.ok) {
			throw new Error(`Failed to fetch session content: ${response.status}`);
		}
		const session = await response.json();

		detailsDiv.innerHTML = ''; // Очищаем детали

		session.forEach((window, index) => {
			const windowItem = document.createElement('div');
			windowItem.className = 'window-item';
			windowItem.innerHTML = `
            <p>Window ${index + 1} (${window.tabs.length} tabs)</p>
            <ul>
                ${window.tabs.map((tab) => `<li>${tab}</li>`).join('')}
            </ul>
            <button class="button-small restore-btn">Restore this Window</button>
        `;
			detailsDiv.appendChild(windowItem);
		});

		const restoreAllButton = document.createElement('button');
		restoreAllButton.className = 'button';
		restoreAllButton.textContent = 'Restore All Windows';
		restoreAllButton.onclick = () => restoreAllWindows(session);
		detailsDiv.appendChild(restoreAllButton);

		detailsDiv.style.display = 'block';
		button.textContent = 'Hide';
	} catch (error) {
		console.error('Error loading session details:', error);
		showNotification('Error', 'Failed to load session details.');
	}
}

// Функция для восстановления отдельного окна
function restoreWindow(tabs) {
	chrome.windows.create({}, (newWindow) => {
		chrome.tabs.query({ windowId: newWindow.id }, (tabsInWindow) => {
			if (tabsInWindow.length > 0) {
				chrome.tabs.remove(tabsInWindow[0].id); // Закрываем пустую вкладку
			}
			tabs.forEach((url, index) => {
				setTimeout(() => {
					chrome.tabs.create({ windowId: newWindow.id, url });
				}, index * 500); // Открываем каждую вкладку с задержкой
			});
		});
	});
}

// Функция для восстановления всех окон
function restoreAllWindows(session) {
	session.forEach((window, windowIndex) => {
		setTimeout(() => {
			restoreWindow(window.tabs);
		}, windowIndex * 900); // Восстанавливаем каждое окно с задержкой
	});
}

// Функция для отображения уведомлений пользователю
function showNotification(title, message) {
	if (chrome.notifications && chrome.notifications.create) {
		chrome.notifications.create(
			'',
			{
				type: 'basic',
				iconUrl: 'icons/icon48.png',
				title: title,
				message: message,
			},
			(notificationId) => {
				if (chrome.runtime.lastError) {
					console.error('Notification Error:', chrome.runtime.lastError);
				} else {
					console.log('Notification shown with ID:', notificationId);
				}
			}
		);
	} else {
		alert(`${title}: ${message}`);
	}
}

// Делегирование событий для кнопок "View" и "Restore"
document.addEventListener('click', async (e) => {
	if (e.target.classList.contains('view-btn')) {
		const filePath = e.target.getAttribute('data-path');
		await viewSessionDetails(filePath, e.target);
	} else if (e.target.classList.contains('restore-btn')) {
		const tabs = Array.from(e.target.parentElement.querySelectorAll('li')).map(
			(li) => li.textContent
		);
		restoreWindow(tabs);
	}
});

// Обработчик кнопки "Save Current Session"
document.getElementById('saveBtn').addEventListener('click', () => {
	// Отправляем сообщение background скрипту для сохранения сессии
	chrome.runtime.sendMessage({ action: 'saveSessionManually' }, (response) => {
		if (response && response.status === 'success') {
			loadSessions(); // Обновляем список сессий
			showNotification('Success', 'Session saved successfully.');
		} else {
			showNotification('Error', 'Failed to save session.');
		}
	});
});

// Переключение темы, уведомлений и загрузка сессий
document.addEventListener('DOMContentLoaded', () => {
	const themeSwitch = document.getElementById('themeSwitch');
	const notificationSwitch = document.getElementById('notificationSwitch');
	const htmlElement = document.documentElement; // Получаем <html> элемент

	// Проверка сохраненной темы в локальном хранилище
	const savedTheme = localStorage.getItem('theme');
	if (savedTheme === 'dark') {
		htmlElement.classList.add('dark-theme');
		themeSwitch.checked = true;
	}

	// Проверка сохраненного состояния уведомлений
	chrome.storage.local.get(['notificationsEnabled'], (result) => {
		let notificationsEnabled = result.notificationsEnabled;
		if (notificationsEnabled === undefined) {
			notificationsEnabled = true; // По умолчанию включены
			chrome.storage.local.set({ notificationsEnabled });
		}
		notificationSwitch.checked = notificationsEnabled;
	});

	// Обработчик переключения темы
	themeSwitch.addEventListener('change', () => {
		if (themeSwitch.checked) {
			htmlElement.classList.add('dark-theme');
			localStorage.setItem('theme', 'dark');
			console.log('Dark theme enabled');
		} else {
			htmlElement.classList.remove('dark-theme');
			localStorage.setItem('theme', 'light');
			console.log('Dark theme disabled');
		}
	});

	// Обработчик переключения уведомлений
	notificationSwitch.addEventListener('change', () => {
		const isEnabled = notificationSwitch.checked;
		chrome.storage.local.set({ notificationsEnabled: isEnabled }, () => {
			console.log(`Push notifications ${isEnabled ? 'enabled' : 'disabled'}`);
			showNotification(
				'Settings Updated',
				`Push notifications ${isEnabled ? 'enabled' : 'disabled'}.`
			);
		});
	});

	// Устанавливаем значение интервала из хранилища
	chrome.storage.local.get(['autoBackupInterval'], (result) => {
		let interval = result.autoBackupInterval;
		if (!interval || isNaN(interval) || interval < 1) {
			interval = 10; // по умолчанию 10 минут
		}
		document.getElementById('intervalInput').value = interval;
	});

	// Загрузка сессий
	loadSessions();
});

// Обработчик изменения поля ввода интервала
document.getElementById('intervalInput').addEventListener('change', () => {
	let intervalValue = document.getElementById('intervalInput').value;
	if (intervalValue && !isNaN(intervalValue) && intervalValue >= 1) {
		chrome.storage.local.set(
			{ autoBackupInterval: parseInt(intervalValue) },
			() => {
				console.log('Auto-save interval updated to', intervalValue, 'minutes');
				showNotification(
					'Settings Updated',
					`Auto backup interval set to ${intervalValue} minutes.`
				);
			}
		);
	} else {
		// Сброс к значению по умолчанию, если введено неверное значение
		document.getElementById('intervalInput').value = 10;
		chrome.storage.local.set({ autoBackupInterval: 10 }, () => {
			console.log('Auto-save interval reset to default (10 minutes)');
			showNotification(
				'Settings Updated',
				'Auto backup interval reset to default (10 minutes).'
			);
		});
	}
});
