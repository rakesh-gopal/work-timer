// Modules to control application life and create native browser window
const {
    app,
    BrowserWindow,
    Tray,
    Menu
} = require('electron');
const path = require('path');

try {
    conf = require('fs').readFileSync(path.join(require('os').homedir(), '.worktimer'), 'utf8');
    conf = JSON.parse(conf);
} catch (exception) {
    conf = {};
}

const WORK_TIME_SECS = (conf.WORK_TIME_MINS || 25) * 60;
const BREAK_TIME_SECS = (conf.BREAK_TIME_MINS || 5) * 60;
const STREAKS_BEFORE_LONG_BREAK = (conf.STREAKS_BEFORE_LONG_BREAK || 4);
const LONG_BREAK_TIME_SECS = (conf.LONG_BREAK_TIME_MINS || 35) * 60;

function secs_to_time_str(secs) {
    mins = parseInt(secs/60);
    mins = mins < 10 ? '0' + mins : mins;
    secs = parseInt(secs%60);
    secs = secs < 10 ? '0' + secs : secs;
    return mins + ':' + secs;
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
    app.dock.hide();
    // Create the browser window.
    mainWindow = new BrowserWindow({
        alwaysOnTop: true,
        width: 400,
        height: 400,
        center: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        title: 'Take a Break'
    });

    // and load the index.html of the app.
    mainWindow.loadFile('index.html');

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('close', function(event) {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        // mainWindow = null;
        event.preventDefault();
        mainWindow.hide();
    });
    mainWindow.setAlwaysOnTop(true);
    mainWindow.hide();

    const iconPath = path.join(__dirname, 'assets/timer-round-white-tiny.png');
    app_tray = new Tray(iconPath);
    tray_menu = Menu.buildFromTemplate([{
            label: 'Pause/Resume',
            click: function() {
                toggle_pause();
            }
        }, {
            label: 'Reset',
            click: function() {
                if (mode == 'paused') {
                    setTimeout(app_tick, 1000);
                }
                reset_timer();
                rerender();
            }
        }, {
            label: '+1 Min',
            click: function() {
                add_to_mode_end_time(60);
                rerender();
            }
        }, {
            label: '-1 Min',
            click: function() {
                add_to_mode_end_time(-60);
                rerender();
            }
        }, {
            label: '+5 Min',
            click: function() {
                add_to_mode_end_time(5 * 60);
                rerender();
            }
        }, {
            label: '-5 Min',
            click: function() {
                add_to_mode_end_time(-5 * 60);
                rerender();
            }
        }, {
            label: 'Quit',
            click: function() {
                app.exit(0);
            }
        }, 
    ]);
    app_tray.setContextMenu(tray_menu);

    function reset_timer() {
        mainWindow.hide();
        mode = 'work';
        mode_start_time = new Date();
        mode_end_time = new Date(mode_start_time.getTime() + WORK_TIME_SECS * 1000);
        work_count = 0;
    }

    function add_to_mode_end_time(seconds) {
        mode_end_time = new Date(mode_end_time.getTime() + seconds * 1000);
    }

    function mini_reset() {
        mainWindow.hide();
        mode = 'work';
        mode_start_time = new Date();
        mode_end_time = new Date(mode_start_time.getTime() + WORK_TIME_SECS * 1000);
    }

    function toggle_mode() {
        let time_remaining = 60000;
        if (mode == 'work') {
            work_count += 1;
            mode = 'break';
            if (work_count < STREAKS_BEFORE_LONG_BREAK) {
                time_remaining = BREAK_TIME_SECS;
            } else {
                time_remaining = LONG_BREAK_TIME_SECS;
                work_count = 0;
            }
            mainWindow.show();
        } else {
            mode = 'work';
            time_remaining = WORK_TIME_SECS;
            mainWindow.hide();
        }
        mode_start_time = new Date();
        mode_end_time = new Date(mode_start_time.getTime() + time_remaining * 1000);
    }

    let prev_mode = null;
    let prev_time_remaining = 0;
    function toggle_pause() {
        if (mode == 'paused') {
            mode = prev_mode;
            mode_end_time = new Date(new Date().getTime() + prev_time_remaining);
            app_tick();
        } else {
            prev_mode = mode;
            prev_time_remaining = mode_end_time - new Date() - 1000;
            mode = 'paused';
        }
        rerender();
    }

    symbol_for = {
        'work': '👨‍💻',
        'break': '😴',
        'paused': '⏸️'
    };

    function rerender() {
        let time_remaining = (mode_end_time - new Date()) / 1000;
        if (time_remaining <= 0.4) {
            toggle_mode();
            time_remaining = (mode_end_time - new Date()) / 1000;
        }
        let title = ' ' + secs_to_time_str(time_remaining) + ' ' + symbol_for[mode] + mode.toUpperCase();
        app_tray.setTitle(title);
    }

    let last_tick;
    function app_tick() {
        let cur_time = new Date();
        if (last_tick) {
            let time_diff = cur_time - last_tick;
            if (time_diff > LONG_BREAK_TIME_SECS / 1.2 * 1000) {
                reset_timer();
            } else if (time_diff > BREAK_TIME_SECS / 1.2 * 1000) {
                mini_reset();
            } else {
                add_to_mode_end_time(time_diff * 2 / 1000);
            }
        }
        if (mode != 'paused') {
            last_tick = cur_time;
            rerender();
            setTimeout(app_tick, 1000);
        } else {
            last_tick = false;
        }
    }

    reset_timer();
    app_tick();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
