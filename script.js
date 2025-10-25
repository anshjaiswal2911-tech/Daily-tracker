document.addEventListener('DOMContentLoaded', () => {
    // --- LOGIN & VIEW SWITCHING LOGIC ---
    const room = document.getElementById('room');
    const lamp = document.getElementById('lamp');
    const loginForm = document.getElementById('loginForm');
    const loginView = document.getElementById('loginView');
    const trackerView = document.getElementById('trackerView');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameSpan = document.getElementById('userName');
    const usernameInput = document.getElementById('username');

    lamp.addEventListener('click', () => room.classList.toggle('lamp-on'));

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const username = usernameInput.value.trim();
        if (username) {
            userNameSpan.textContent = username;
            loginView.classList.add('hidden');
            trackerView.classList.add('active');
        }
    });

    logoutBtn.addEventListener('click', () => {
        trackerView.classList.remove('active');
        loginView.classList.remove('hidden');
        room.classList.remove('lamp-on');
        loginForm.reset();
    });

    // --- TRACKER APP LOGIC ---
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    const currentDateEl = document.getElementById('currentDate');
    const dailyQuoteEl = document.getElementById('dailyQuote');

    // Data
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let habits = JSON.parse(localStorage.getItem('habits')) || [];
    let goals = JSON.parse(localStorage.getItem('goals')) || [];
    let journalEntries = JSON.parse(localStorage.getItem('journalEntries')) || [];
    let notes = localStorage.getItem('notes') || '';
    let points = parseInt(localStorage.getItem('points')) || 0;
    let badges = JSON.parse(localStorage.getItem('badges')) || [];
    let currentFilter = 'all';

    // Quotes
    const quotes = [
        "The secret of getting ahead is getting started.", "Focus on being productive instead of busy.",
        "The way to get started is to quit talking and begin doing.", "Don't watch the clock; do what it does. Keep going.",
        "You don’t have to be great to start, but you have to start to be great."
    ];

    // --- INITIALIZATION ---
    function init() {
        setDate();
        setDailyQuote();
        loadNotes();
        loadJournalEntries();
        renderTasks();
        renderHabits();
        renderGoals();
        updateStats();
        renderBadges();
        initChart();
        fetchWeather();
        setupKeyboardShortcuts();
    }

    function setDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
    }

    function setDailyQuote() {
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        dailyQuoteEl.textContent = quotes[dayOfYear % quotes.length];
    }

    // --- VIEW MANAGEMENT ---
    function showView(viewId) {
        contentSections.forEach(section => section.classList.remove('active'));
        navItems.forEach(item => item.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        document.querySelector(`[data-view="${viewId}"]`).classList.add('active');
    }
    navItems.forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
    window.showView = showView;

    // --- GAMIFICATION: POINTS & BADGES ---
    function addPoints(amount) {
        points += amount;
        localStorage.setItem('points', points);
        updateStats();
    }

    function addBadge(id, name, icon) {
        if (!badges.find(b => b.id === id)) {
            badges.push({ id, name, icon });
            localStorage.setItem('badges', JSON.stringify(badges));
            renderBadges();
            alert(`Congratulations! You've earned the "${name}" badge!`);
        }
    }

    function renderBadges() {
        const badgesList = document.getElementById('badgesList');
        badgesList.innerHTML = '';
        if (badges.length === 0) {
            badgesList.innerHTML = '<p style="color: var(--text-muted);">Complete tasks to earn badges!</p>';
            return;
        }
        badges.forEach(badge => {
            const badgeEl = document.createElement('div');
            badgeEl.className = 'badge';
            badgeEl.innerHTML = `<i class="${badge.icon}"></i> ${badge.name}`;
            badgesList.appendChild(badgeEl);
        });
    }

    // --- GOALS LOGIC ---
    const goalInput = document.getElementById('goalInput');
    const addGoalBtn = document.getElementById('addGoalBtn');
    const goalsList = document.getElementById('goalsList');
    const taskGoalSelect = document.getElementById('taskGoal');

    function saveGoals() {
        localStorage.setItem('goals', JSON.stringify(goals));
        updateGoalDropdown();
    }

    function renderGoals() {
        goalsList.innerHTML = '';
        goals.forEach(goal => {
            const div = document.createElement('div');
            div.className = 'goal-card';
            div.innerHTML = `
                <div>
                    <h4>${goal.text}</h4>
                    <p>${tasks.filter(t => t.goalId === goal.id).length} tasks linked</p>
                </div>
                <button class="delete-goal-btn" data-id="${goal.id}"><i class="fas fa-trash"></i></button>
            `;
            goalsList.appendChild(div);
        });
        updateGoalDropdown();
    }

    function addGoal() {
        const text = goalInput.value.trim();
        if (text === '') return;
        const newGoal = { id: Date.now(), text: text };
        goals.push(newGoal);
        saveGoals();
        renderGoals();
        goalInput.value = '';
    }

    function deleteGoal(id) {
        goals = goals.filter(g => g.id !== parseInt(id));
        tasks.forEach(t => { if (t.goalId === parseInt(id)) t.goalId = null; });
        saveGoals();
        saveTasks();
        renderGoals();
        renderTasks();
    }

    function updateGoalDropdown() {
        taskGoalSelect.innerHTML = '<option value="">No Goal</option>';
        goals.forEach(goal => {
            const option = document.createElement('option');
            option.value = goal.id;
            option.textContent = goal.text;
            taskGoalSelect.appendChild(option);
        });
    }

    addGoalBtn.addEventListener('click', addGoal);
    goalInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addGoal(); });
    goalsList.addEventListener('click', (e) => {
        if (e.target.closest('.delete-goal-btn')) {
            deleteGoal(e.target.closest('.delete-goal-btn').dataset.id);
        }
    });

    // --- TASKS LOGIC ---
    const taskInput = document.getElementById('taskInput');
    const taskCategory = document.getElementById('taskCategory');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskList = document.getElementById('taskList');
    const filterBtns = document.querySelectorAll('.filter-btn');

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        updateChart();
        renderGoals(); // To update task count on goal cards
    }

    function renderTasks() {
        taskList.innerHTML = '';
        const filteredTasks = currentFilter === 'all' ? tasks : tasks.filter(t => t.category === currentFilter);
        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.dataset.id = task.id;
            if (task.completed) li.classList.add('completed');
            const goalText = goals.find(g => g.id === task.goalId)?.text || '';
            li.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                <span class="task-text">${task.text}</span>
                <span class="task-category cat-${task.category}">${task.category}</span>
                ${goalText ? `<span class="task-goal goal-tag">${goalText}</span>` : ''}
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;
            taskList.appendChild(li);
        });
        updateStats();
    }

    function addTask() {
        const text = taskInput.value.trim();
        if (text === '') return;
        const newTask = {
            id: Date.now(), text: text, completed: false,
            category: taskCategory.value, goalId: parseInt(taskGoalSelect.value) || null,
            date: new Date().toDateString()
        };
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        taskInput.value = '';
        if (tasks.length === 1) addBadge('first_task', 'First Task', 'fas fa-star');
    }

    function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            if (!task.completed) addPoints(10);
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
        }
    }

    function deleteTask(id) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
    }

    function updateStats() {
        const today = new Date().toDateString();
        const totalTasks = tasks.filter(t => t.date === today).length;
        const completedTasks = tasks.filter(t => t.completed && t.date === today).length;
        const leftTasks = totalTasks - completedTasks;
        document.getElementById('homeTasksLeft').textContent = leftTasks;
        document.getElementById('homeTasksCompleted').textContent = completedTasks;
        document.getElementById('homePoints').textContent = points;
    }

    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });
    taskList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const id = parseInt(li.dataset.id);
        if (e.target.classList.contains('task-checkbox')) toggleTask(id);
        else if (e.target.closest('.delete-btn')) deleteTask(id);
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    // --- HABITS LOGIC ---
    const habitInput = document.getElementById('habitInput');
    const addHabitBtn = document.getElementById('addHabitBtn');
    const habitsList = document.getElementById('habitsList');

    function saveHabits() { localStorage.setItem('habits', JSON.stringify(habits)); }
    function renderHabits() {
        habitsList.innerHTML = '';
        const today = new Date().toDateString();
        habits.forEach(habit => {
            const isDoneToday = habit.completedDates.includes(today);
            const div = document.createElement('div');
            div.className = `habit-card ${isDoneToday ? 'done' : ''}`;
            div.innerHTML = `
                <h4>${habit.text}</h4>
                <p class="streak"><i class="fas fa-fire"></i> ${habit.streak} day streak</p>
                <button class="habit-check-btn">${isDoneToday ? 'Done for Today!' : 'Mark as Done'}</button>
            `;
            div.querySelector('.habit-check-btn').addEventListener('click', () => toggleHabit(habit.id));
            habitsList.appendChild(div);
        });
    }
    function addHabit() {
        const text = habitInput.value.trim();
        if (text === '') return;
        const newHabit = { id: Date.now(), text: text, completedDates: [], streak: 0 };
        habits.push(newHabit);
        saveHabits();
        renderHabits();
        habitInput.value = '';
    }
    function toggleHabit(id) {
        const habit = habits.find(h => h.id === id);
        const today = new Date().toDateString();
        if (!habit) return;
        if (!habit.completedDates.includes(today)) {
            habit.completedDates.push(today);
            habit.streak++;
            addPoints(15);
            if (habit.streak === 7) addBadge('week_streak', 'Week Streak', 'fas fa-fire-alt');
        } else {
            habit.completedDates = habit.completedDates.filter(d => d !== today);
            habit.streak = calculateStreak(habit.completedDates);
        }
        saveHabits();
        renderHabits();
    }
    function calculateStreak(dates) {
        if (dates.length === 0) return 0;
        const sortedDates = dates.map(d => new Date(d)).sort((a, b) => b - a);
        let streak = 1;
        for (let i = 0; i < sortedDates.length - 1; i++) {
            const diff = (sortedDates[i] - sortedDates[i + 1]) / (1000 * 60 * 60 * 24);
            if (diff === 1) streak++;
            else break;
        }
        return streak;
    }
    addHabitBtn.addEventListener('click', addHabit);
    habitInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addHabit(); });

    // --- JOURNAL LOGIC ---
    const journalInput = document.getElementById('journalInput');
    const saveJournalBtn = document.getElementById('saveJournalBtn');
    const journalEntriesEl = document.getElementById('journalEntries');

    function saveJournalEntries() {
        localStorage.setItem('journalEntries', JSON.stringify(journalEntries));
    }

    function loadJournalEntries() {
        journalEntriesEl.innerHTML = '';
        if (journalEntries.length === 0) {
            journalEntriesEl.innerHTML = '<p style="color: var(--text-muted);">No entries yet. Start writing!</p>';
            return;
        }
        // Show latest first
        [...journalEntries].reverse().forEach(entry => {
            const div = document.createElement('div');
            div.className = 'journal-entry';
            div.innerHTML = `
                <div class="journal-entry-date">${new Date(entry.date).toLocaleString()}</div>
                <div class="journal-entry-text">${entry.text}</div>
            `;
            journalEntriesEl.appendChild(div);
        });
    }

    function saveJournalEntry() {
        const text = journalInput.value.trim();
        if (text === '') return;
        const newEntry = { id: Date.now(), text: text, date: new Date().toISOString() };
        journalEntries.push(newEntry);
        saveJournalEntries();
        loadJournalEntries();
        journalInput.value = '';
        alert('Journal entry saved!');
    }

    saveJournalBtn.addEventListener('click', saveJournalEntry);

    // --- TIMER, NOTES, CHART LOGIC (Largely unchanged) ---
    let timerInterval; let timeLeft = 25 * 60; let isBreak = false;
    const timerTimeEl = document.getElementById('timerTime'); const timerPhaseEl = document.getElementById('timerPhase');
    const startTimerBtn = document.getElementById('startTimerBtn'); const pauseTimerBtn = document.getElementById('pauseTimerBtn'); const resetTimerBtn = document.getElementById('resetTimerBtn');
    function updateTimerDisplay() { const m = Math.floor(timeLeft / 60); const s = timeLeft % 60; timerTimeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; }
    function startTimer() { if (timerInterval) return; timerInterval = setInterval(() => { timeLeft--; updateTimerDisplay(); if (timeLeft < 0) { clearInterval(timerInterval); timerInterval = null; alert(isBreak ? 'Break over!' : 'Time for a break!'); isBreak = !isBreak; timeLeft = isBreak ? 5 * 60 : 25 * 60; timerPhaseEl.textContent = isBreak ? 'Break Time' : 'Work Time'; updateTimerDisplay(); } }, 1000); }
    function pauseTimer() { clearInterval(timerInterval); timerInterval = null; }
    function resetTimer() { pauseTimer(); isBreak = false; timeLeft = 25 * 60; timerPhaseEl.textContent = 'Work Time'; updateTimerDisplay(); }
    startTimerBtn.addEventListener('click', startTimer); pauseTimerBtn.addEventListener('click', pauseTimer); resetTimerBtn.addEventListener('click', resetTimer);

    const notesArea = document.getElementById('notesArea');
    function loadNotes() { notesArea.value = notes; }
    function saveNotes() { notes = notesArea.value; localStorage.setItem('notes', notes); }
    notesArea.addEventListener('input', saveNotes);

    let progressChart;
    function initChart() {
        const ctx = document.getElementById('progressChart').getContext('2d');
        progressChart = new Chart(ctx, {
            type: 'bar', data: { labels: getLast7Days(), datasets: [{ label: 'Tasks Completed', data: getTaskDataForLast7Days(), backgroundColor: 'rgba(243, 156, 18, 0.5)', borderColor: 'rgba(243, 156, 18, 1)', borderWidth: 1 }] },
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1, color: '#888' }, grid: { color: '#333' } }, x: { ticks: { color: '#888' }, grid: { color: '#333' } } }, plugins: { legend: { labels: { color: '#e0e0e0' } } } }
        });
    }
    function getLast7Days() { const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toLocaleDateString('en-US', { weekday: 'short' })); } return days; }
    function getTaskDataForLast7Days() { const data = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const dateStr = d.toDateString(); const completedCount = tasks.filter(t => t.completed && t.date === dateStr).length; data.push(completedCount); } return data; }
    function updateChart() { if (progressChart) { progressChart.data.datasets[0].data = getTaskDataForLast7Days(); progressChart.update(); } }

    // --- NEW FEATURES LOGIC ---

    // 1. Weather Widget
    function fetchWeather() {
        // NOTE: For a real app, you'd use an API key.
        // This is a simulated response.
        const weatherData = {
            temp_c: 22, // Example temperature in Celsius
            condition: { text: "Partly cloudy" }
        };
        document.getElementById('weatherTemp').textContent = `${weatherData.temp_c}°C`;
        document.getElementById('weatherDesc').textContent = weatherData.condition.text;
    }

    // 2. Focus Mode
    const focusModeBtn = document.getElementById('focusModeBtn');
    const focusModeOverlay = document.getElementById('focusModeOverlay');
    const exitFocusBtn = document.getElementById('exitFocusBtn');
    const focusQuoteEl = document.getElementById('focusQuote');
    const focusTimerTimeEl = document.getElementById('focusTimerTime');

    focusModeBtn.addEventListener('click', () => {
        focusQuoteEl.textContent = dailyQuoteEl.textContent;
        focusTimerTimeEl.textContent = '25:00';
        focusModeOverlay.classList.add('active');
        // Start a simple timer for focus mode
        let focusTimeLeft = 25 * 60;
        const focusInterval = setInterval(() => {
            focusTimeLeft--;
            const m = Math.floor(focusTimeLeft / 60);
            const s = focusTimeLeft % 60;
            focusTimerTimeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            if (focusTimeLeft < 0) {
                clearInterval(focusInterval);
                alert('Focus session over! Great job.');
                exitFocusMode();
            }
        }, 1000);
        focusModeOverlay.dataset.intervalId = focusInterval;
    });

    function exitFocusMode() {
        clearInterval(focusModeOverlay.dataset.intervalId);
        focusModeOverlay.classList.remove('active');
    }

    exitFocusBtn.addEventListener('click', exitFocusMode);

    // 3. Data Export
    const exportDataBtn = document.getElementById('exportDataBtn');
    exportDataBtn.addEventListener('click', () => {
        const allData = {
            tasks, habits, goals, journalEntries, notes, points, badges
        };
        const dataStr = JSON.stringify(allData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `productivity-hub-backup-${new Date().toISOString().slice(0,10)}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });

    // 4. Keyboard Shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+N for new task
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                showView('tasks-view');
                taskInput.focus();
            }
            // Ctrl+H for habits
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                showView('habits-view');
            }
            // Ctrl+J for journal
            if (e.ctrlKey && e.key === 'j') {
                e.preventDefault();
                showView('journal-view');
                journalInput.focus();
            }
            // Esc for focus mode
            if (e.key === 'Escape' && focusModeOverlay.classList.contains('active')) {
                exitFocusMode();
            }
        });
    }

    // --- Initial Load ---
    init();
});