'use strict';

var app = document.getElementById('app');
var list = document.getElementById('list');
var message = document.getElementById('message');
var remove = document.getElementById('remove');
var add = document.getElementById('add');
var preview = document.getElementById('preview');
var form = {
  path: app.querySelector('[data-id=path]'),
  name: app.querySelector('[data-id=name]'),
  args: app.querySelector('[data-id=arguments]'),
  toolbar: app.querySelector('[data-id=toolbar]'),
  menuitem: app.querySelector('[data-id=menuitem]'),
  context: app.querySelector('[data-id=context]'),
  pattern: app.querySelector('[data-id=pattern]'),
  icon: app.querySelector('[data-id=icon]'),
  errors: app.querySelector('[data-id=errors]'),
  quotes: app.querySelector('[data-id=quotes]'),
  closeme: app.querySelector('[data-id=closeme]')
};

var id;

function show(msg) {
  window.clearTimeout(id);
  message.textContent = msg;
  id = window.setTimeout(() => message.textContent = '', 2000);
}

function update(value) {
  list.textContent = '';
  chrome.storage.local.get({
    apps: {},
    save: ''
  }, prefs => {
    prefs.apps = Object.assign({
      blank: {
        name: '- new -'
      }
    }, prefs.apps);
    Object.keys(prefs.apps).forEach(id => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = prefs.apps[id].name;
      list.appendChild(option);
    });
    if (value) {
      list.value = value;
    }
    else if (prefs.save && prefs.apps[prefs.save]) {
      list.value = prefs.save;
    }
    else {
      list.value = 'blank';
    }
    list.dispatchEvent(new Event('change'));
  });
}
update();

function save({id, icon, errors, quotes, closeme, name, path, args, toolbar, context, pattern}) {
  pattern = (pattern || '').split(/\s*,\s*/).filter((s, i, l) => l.indexOf(s) === i).join(', ');
  chrome.storage.local.get({
    apps: {}
  }, prefs => {
    prefs.apps[id] = {
      icon,
      errors,
      quotes,
      closeme,
      name,
      path,
      args,
      toolbar,
      context,
      pattern
    };
    chrome.storage.local.set(prefs, () => {
      update(id);
      show('Done!');
    });
  });
}

function collect(callback) {
  const id = app.dataset.id || Math.random();

  const name = form.name.value;
  if (!name) {
    return show('"Display Name" is mandatory');
  }
  const path = form.path.value;
  if (!path) {
    return show('"Executable Name" is mandatory');
  }
  const args = form.args.value;
  const toolbar = form.toolbar.checked;
  const menuitem = form.context.querySelector(':checked');
  if (!toolbar && !menuitem) {
    return show('Select a placement for this application');
  }
  const context = [...form.context.querySelectorAll(':checked')].map(e => e.value);
  const pattern = form.pattern.value;
  const errors = form.errors.checked;
  const quotes = form.quotes.checked;
  const closeme = form.closeme.checked;
  const icon = form.icon.files[0];
  if (!icon && !app.dataset.file) {
    return show('"Icon" is mandatory');
  }

  const s = {id, name, errors, quotes, closeme, path, args, toolbar, context, pattern};
  if (icon) {
    if (icon.size > 5 * 1024) {
      return show('"Icon" is too big! use 16x16 PNG.');
    }
    const reader = new FileReader();
    reader.onload = () => {
      s.icon = reader.result;
      callback(s);
    };
    reader.readAsDataURL(icon);
  }
  else {
    s.icon = app.dataset.file;
    callback(s);
  }
}

document.addEventListener('click', e => {
  const target = e.target;
  const cmd = target.dataset.cmd;
  if (cmd === 'add') {
    collect(save);
  }
  else if (cmd === 'remove') {
    chrome.storage.local.get({
      apps: {},
      active: null
    }, prefs => {
      delete prefs.apps[list.value];
      if (prefs.active === list.value) {
        prefs.active = null;
      }
      chrome.storage.local.set(prefs, update);
    });
  }
  else if (cmd === 'insert') {
    const text = target.dataset.value;
    const startPos = form.args.selectionStart;
    const endPos = form.args.selectionEnd;
    form.args.value = form.args.value.substring(0, startPos) +
      text +
      form.args.value.substring(endPos, form.args.value.length);
    form.args.selectionStart = startPos + text.length;
    form.args.selectionEnd = startPos + text.length;
    form.args.focus();
  }
  else if (cmd === 'example') {
    form.name.value = target.dataset.name;
    form.path.value = target.dataset.path;
    form.args.value = target.dataset.args;
  }
  else if (cmd === 'test') {
    collect(app => {
      chrome.runtime.sendMessage({
        method: 'parse',
        app
      }, resp => {
        const doc = preview.contentDocument;
        doc.body.textContent = '';
        const ul = document.createElement('ul');
        resp.forEach(s => ul.appendChild(Object.assign(doc.createElement('li'), {
          textContent: s
        })));
        doc.body.appendChild(ul);
        preview.style.display = 'block';
      });
    });
  }
  else if (cmd === 'clear') {
    chrome.storage.local.set({
      external_denied: [],
      external_allowed: [],
    }, chrome.runtime.sendMessage({
      method: 'notify',
      message: 'Both allowed and denied lists are cleared. New external commands will prompt for user approval!'
    }));
  }
});

document.body.addEventListener('click', () => {
  preview.style.display = 'none';
});

list.addEventListener('change', () => {
  const disabled = list.selectedIndex === -1 || list.selectedIndex === 0;
  remove.disabled = disabled;
  add.value = disabled ? 'Add Application' : 'Update Application';

  chrome.storage.local.set({
    save: list.value
  });

  if (!disabled) {
    chrome.storage.local.get({
      apps: {}
    }, prefs => {
      form.name.value = prefs.apps[list.value].name;
      form.errors.checked = prefs.apps[list.value].errors;
      form.quotes.checked = prefs.apps[list.value].quotes;
      form.closeme.checked = prefs.apps[list.value].closeme;
      form.path.value = prefs.apps[list.value].path;
      form.args.value = prefs.apps[list.value].args;
      form.toolbar.checked = prefs.apps[list.value].toolbar;
      [...form.context.querySelectorAll(':checked')].forEach(e => e.checked = false);
      let contexts = prefs.apps[list.value].context;
      if (typeof contexts === 'string') {
        contexts = [contexts];
      }
      contexts.forEach(value => {
        form.context.querySelector(`[value="${value}"]`).checked = true;
      });
      form.pattern.value = prefs.apps[list.value].pattern || '';
      app.dataset.file = prefs.apps[list.value].icon;
      form.icon.value = '';
      app.dataset.id = list.value;
      if (prefs.apps[list.value].toolbar) {
        chrome.storage.local.set({
          active: list.value,
        });
      }
    });
  }
  else {
    delete app.dataset.file;
    delete app.dataset.id;
  }
});
