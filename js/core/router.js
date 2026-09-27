/* =========================================================================
   router.js — navegación por hash con transición entre pantallas.
   ========================================================================= */
(function (root) {
  'use strict';
  var U = root.Casino.util;

  var routes = {};
  var host = null;
  var current = null;
  var currentHandle = null;
  var navigating = false;
  var bus = U.emitter();

  function define(name, handler) {
    routes[name] = handler;
  }

  function setHost(node) { host = node; }

  function parse(hash) {
    var raw = (hash || root.location.hash || '#/').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean);
    return { name: parts[0] || 'lobby', param: parts[1] || null };
  }

  function go(path, opts) {
    opts = opts || {};
    var target = '#/' + String(path).replace(/^#?\/?/, '');
    if (root.location.hash === target) {
      render(); // misma ruta: re-render forzado
      return;
    }
    if (opts.replace && root.location.replace) {
      root.location.replace(target);
    } else {
      root.location.hash = target;
    }
  }

  function render() {
    if (!host) return;
    var route = parse();
    var handler = routes[route.name] || routes['404'] || routes.lobby;
    if (navigating) return;
    navigating = true;

    // Salida: desmontamos la pantalla anterior antes de construir la nueva.
    if (currentHandle && currentHandle.destroy) {
      try { currentHandle.destroy(); } catch (e) { console.error(e); }
    }
    currentHandle = null;

    host.classList.add('is-leaving');

    var delay = root.Casino.fx && root.Casino.fx.reduced ? 0 : 130;
    root.setTimeout(function () {
      U.clear(host);
      host.scrollTop = 0;
      host.classList.remove('is-leaving');
      host.classList.add('is-entering');
      try {
        currentHandle = handler(host, route.param) || null;
      } catch (e) {
        console.error('Error al montar la pantalla', route, e);
        host.appendChild(U.el('.screen-error', {}, [
          U.el('h2', { text: 'No se pudo abrir esta pantalla' }),
          U.el('p', { text: 'Vuelve al vestíbulo e inténtalo de nuevo.' })
        ]));
      }
      current = route;
      bus.emit('change', route);
      root.requestAnimationFrame(function () {
        host.classList.remove('is-entering');
        navigating = false;
      });
    }, delay);
  }

  function start(hostNode) {
    setHost(hostNode);
    root.addEventListener('hashchange', render);
    render();
  }

  root.Casino.router = {
    define: define, go: go, start: start, render: render,
    get current() { return current; },
    parse: parse,
    on: bus.on.bind(bus)
  };
})(typeof window !== 'undefined' ? window : globalThis);
