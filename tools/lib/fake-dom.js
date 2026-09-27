/* =========================================================================
   fake-dom.js — DOM mínimo pero DE VERDAD para las pruebas sin navegador.

   No es un DOM completo: implementa lo justo que usan los juegos (árbol de
   nodos, clases, atributos y querySelector/querySelectorAll con selectores
   sencillos). La razón de existir es concreta: con un DOM de mentira que
   devolvía null en querySelector, las pruebas no podían montar los juegos y
   un fallo real en Plinko se colaba hasta el navegador. Con esto,
   `node tools/test.js` monta las 12 máquinas y caza esa clase de error.
   ========================================================================= */
'use strict';

function parseSelector(sel) {
  /* Admite: "tag", ".clase", "#id", ".a.b", "tag.clase" y varias partes
     separadas por espacios (descendiente). Las comas se tratan aparte. */
  return sel.trim().split(/\s+/).map(part => {
    const m = { tag: null, id: null, classes: [] };
    const tagMatch = /^[a-zA-Z][\w-]*/.exec(part);
    if (tagMatch) m.tag = tagMatch[0].toLowerCase();
    const rest = tagMatch ? part.slice(tagMatch[0].length) : part;
    (rest.match(/[.#][\w-]+/g) || []).forEach(tok => {
      if (tok[0] === '.') m.classes.push(tok.slice(1));
      else m.id = tok.slice(1);
    });
    return m;
  });
}

function matchesSimple(node, m) {
  if (m.tag && node.tagName.toLowerCase() !== m.tag) return false;
  if (m.id && node.id !== m.id) return false;
  for (const c of m.classes) if (!node.classList.contains(c)) return false;
  return true;
}

class ClassList {
  constructor(node) { this._node = node; this._set = new Set(); }
  add() { for (const c of arguments) if (c) this._set.add(c); this._sync(); }
  remove() { for (const c of arguments) this._set.delete(c); this._sync(); }
  toggle(c, force) {
    const want = force === undefined ? !this._set.has(c) : !!force;
    if (want) this._set.add(c); else this._set.delete(c);
    this._sync();
    return want;
  }
  contains(c) { return this._set.has(c); }
  get value() { return [...this._set].join(' '); }
  _sync() { this._node._className = this.value; }
  _setAll(str) {
    this._set = new Set(String(str || '').split(/\s+/).filter(Boolean));
    this._node._className = this.value;
  }
}

let uid = 0;

class Node {
  constructor(tagName) {
    this.tagName = (tagName || 'div').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = new ClassList(this);
    this._className = '';
    this.id = '';
    this.style = new Proxy({ setProperty(k, v) { this[k] = v; } }, {});
    this.dataset = {};
    this.attributes = {};
    this._listeners = {};
    this._text = '';
    this.disabled = false;
    this.hidden = false;
    this.value = '';
    this._uid = ++uid;
  }

  /* --- clase --- */
  get className() { return this._className; }
  set className(v) { this.classList._setAll(v); }

  /* --- texto --- */
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map(c => c.textContent).join('');
  }
  set textContent(v) { this._text = v === undefined || v === null ? '' : String(v); this.children = []; }

  get innerHTML() { return this._html || ''; }
  set innerHTML(v) { this._html = String(v); this.children = []; }

  /* --- árbol --- */
  appendChild(child) {
    if (!child) return child;
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, ref) {
    if (!child) return child;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    if (i === -1) this.children.push(child); else this.children.splice(i, 0, child);
    return child;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i !== -1) { this.children.splice(i, 1); child.parentNode = null; }
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  get firstChild() { return this.children[0] || null; }
  get isConnected() {
    let n = this;
    while (n.parentNode) n = n.parentNode;
    return n._isRoot === true;
  }

  /* --- atributos --- */
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'class') this.className = v;
    else if (k === 'id') this.id = String(v);
  }
  /* Los <use> de SVG usan href con espacio de nombres. */
  setAttributeNS(ns, k, v) { this.setAttribute(k, v); }
  getAttributeNS(ns, k) { return this.getAttribute(k); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  hasAttribute(k) { return k in this.attributes; }

  /* --- eventos (no se disparan; sólo se registran) --- */
  addEventListener(type, fn) { (this._listeners[type] || (this._listeners[type] = [])).push(fn); }
  removeEventListener(type, fn) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter(f => f !== fn);
  }
  /** Permite que una prueba invoque un manejador registrado. */
  _fire(type, evt) {
    (this._listeners[type] || []).slice().forEach(f => f(evt || { preventDefault() {}, stopPropagation() {} }));
  }

  /* --- consultas --- */
  _walk(fn) {
    for (const c of this.children) { fn(c); c._walk(fn); }
  }
  querySelector(sel) { return this.querySelectorAll(sel, true)[0] || null; }
  querySelectorAll(sel, firstOnly) {
    const groups = String(sel).split(',').map(s => parseSelector(s)).filter(g => g.length);
    const out = [];
    this._walk(node => {
      if (firstOnly && out.length) return;
      for (const chain of groups) {
        if (matchesChain(node, chain)) { out.push(node); break; }
      }
    });
    return out;
  }

  /* --- geometría / layout (valores fijos, suficientes) --- */
  getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 }; }
  get clientHeight() { return 240; }
  get clientWidth() { return 400; }
  get offsetWidth() { return 400; }
  get offsetHeight() { return 240; }
  focus() {}
  scrollTo() {}
  set scrollTop(v) { this._scrollTop = v; }
  get scrollTop() { return this._scrollTop || 0; }
}

function matchesChain(node, chain) {
  /* El último eslabón debe coincidir con el nodo; los anteriores, con
     algún ancestro, en orden. */
  if (!matchesSimple(node, chain[chain.length - 1])) return false;
  let i = chain.length - 2;
  let p = node.parentNode;
  while (i >= 0 && p) {
    if (matchesSimple(p, chain[i])) i--;
    p = p.parentNode;
  }
  return i < 0;
}

function createDocument() {
  const doc = {
    readyState: 'complete',
    visibilityState: 'visible',
    _listeners: {},
    createElement: tag => new Node(tag),
    createElementNS: (ns, tag) => new Node(tag),
    createTextNode: t => { const n = new Node('#text'); n.textContent = t; return n; },
    addEventListener(type, fn) { (doc._listeners[type] || (doc._listeners[type] = [])).push(fn); },
    removeEventListener(type, fn) {
      if (doc._listeners[type]) doc._listeners[type] = doc._listeners[type].filter(f => f !== fn);
    }
  };
  doc.documentElement = new Node('html');
  doc.documentElement._isRoot = true;
  doc.body = new Node('body');
  doc.documentElement.appendChild(doc.body);
  doc.querySelector = sel => doc.documentElement.querySelector(sel);
  doc.querySelectorAll = sel => doc.documentElement.querySelectorAll(sel);
  doc.getElementById = id => {
    let found = null;
    doc.documentElement._walk(n => { if (!found && n.id === id) found = n; });
    return found;
  };
  return doc;
}

module.exports = { Node, createDocument };
