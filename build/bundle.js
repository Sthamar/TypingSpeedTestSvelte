
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.59.2 */
    const file = "src\\App.svelte";

    // (103:2) {#if timeLeft === 0 || userText.trim() === testText.trim()}
    function create_if_block(ctx) {
    	let div;
    	let h2;
    	let t1;
    	let p0;
    	let strong0;
    	let t3;
    	let t4;
    	let t5;
    	let p1;
    	let strong1;
    	let t7;
    	let t8;
    	let t9;
    	let t10;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Results";
    			t1 = space();
    			p0 = element("p");
    			strong0 = element("strong");
    			strong0.textContent = "WPM:";
    			t3 = space();
    			t4 = text(/*wpm*/ ctx[2]);
    			t5 = space();
    			p1 = element("p");
    			strong1 = element("strong");
    			strong1.textContent = "Accuracy:";
    			t7 = space();
    			t8 = text(/*accuracy*/ ctx[3]);
    			t9 = text("%");
    			t10 = space();
    			button = element("button");
    			button.textContent = "Restart Test";
    			add_location(h2, file, 104, 4, 2200);
    			add_location(strong0, file, 105, 7, 2224);
    			add_location(p0, file, 105, 4, 2221);
    			add_location(strong1, file, 106, 7, 2263);
    			add_location(p1, file, 106, 4, 2260);
    			attr_dev(button, "class", "svelte-jjd23e");
    			add_location(button, file, 107, 4, 2310);
    			attr_dev(div, "class", "svelte-jjd23e");
    			add_location(div, file, 103, 3, 2190);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, p0);
    			append_dev(p0, strong0);
    			append_dev(p0, t3);
    			append_dev(p0, t4);
    			append_dev(div, t5);
    			append_dev(div, p1);
    			append_dev(p1, strong1);
    			append_dev(p1, t7);
    			append_dev(p1, t8);
    			append_dev(p1, t9);
    			append_dev(div, t10);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*resetTest*/ ctx[6], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*wpm*/ 4) set_data_dev(t4, /*wpm*/ ctx[2]);
    			if (dirty & /*accuracy*/ 8) set_data_dev(t8, /*accuracy*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(103:2) {#if timeLeft === 0 || userText.trim() === testText.trim()}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div;
    	let h1;
    	let t1;
    	let p0;
    	let strong0;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let p1;
    	let strong1;
    	let t8;
    	let t9;
    	let t10;
    	let textarea;
    	let textarea_disabled_value;
    	let t11;
    	let show_if = /*timeLeft*/ ctx[1] === 0 || /*userText*/ ctx[0].trim() === /*testText*/ ctx[4].trim();
    	let mounted;
    	let dispose;
    	let if_block = show_if && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Typing Speed Test";
    			t1 = space();
    			p0 = element("p");
    			strong0 = element("strong");
    			strong0.textContent = "Time Left:";
    			t3 = space();
    			t4 = text(/*timeLeft*/ ctx[1]);
    			t5 = text(" seconds");
    			t6 = space();
    			p1 = element("p");
    			strong1 = element("strong");
    			strong1.textContent = "Test Text:";
    			t8 = space();
    			t9 = text(/*testText*/ ctx[4]);
    			t10 = space();
    			textarea = element("textarea");
    			t11 = space();
    			if (if_block) if_block.c();
    			attr_dev(h1, "class", "svelte-jjd23e");
    			add_location(h1, file, 91, 2, 1847);
    			add_location(strong0, file, 92, 5, 1879);
    			add_location(p0, file, 92, 2, 1876);
    			add_location(strong1, file, 93, 5, 1935);
    			add_location(p1, file, 93, 2, 1932);
    			attr_dev(textarea, "placeholder", "Start typing here...");
    			textarea.disabled = textarea_disabled_value = /*timeLeft*/ ctx[1] === 0;
    			attr_dev(textarea, "class", "svelte-jjd23e");
    			add_location(textarea, file, 95, 2, 1981);
    			attr_dev(div, "class", "svelte-jjd23e");
    			add_location(div, file, 90, 1, 1839);
    			add_location(main, file, 89, 0, 1831);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, p0);
    			append_dev(p0, strong0);
    			append_dev(p0, t3);
    			append_dev(p0, t4);
    			append_dev(p0, t5);
    			append_dev(div, t6);
    			append_dev(div, p1);
    			append_dev(p1, strong1);
    			append_dev(p1, t8);
    			append_dev(p1, t9);
    			append_dev(div, t10);
    			append_dev(div, textarea);
    			set_input_value(textarea, /*userText*/ ctx[0]);
    			append_dev(div, t11);
    			if (if_block) if_block.m(div, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[8]),
    					listen_dev(textarea, "focus", /*startTimer*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*timeLeft*/ 2) set_data_dev(t4, /*timeLeft*/ ctx[1]);

    			if (dirty & /*timeLeft*/ 2 && textarea_disabled_value !== (textarea_disabled_value = /*timeLeft*/ ctx[1] === 0)) {
    				prop_dev(textarea, "disabled", textarea_disabled_value);
    			}

    			if (dirty & /*userText*/ 1) {
    				set_input_value(textarea, /*userText*/ ctx[0]);
    			}

    			if (dirty & /*timeLeft, userText*/ 3) show_if = /*timeLeft*/ ctx[1] === 0 || /*userText*/ ctx[0].trim() === /*testText*/ ctx[4].trim();

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let testText = "The quick brown fox jumps over the lazy dog.";
    	let userText = "";
    	let timeLeft = 30;
    	let timerActive = false;
    	let timer;
    	let wpm = 0;
    	let accuracy = 0;

    	// Start the timer
    	const startTimer = () => {
    		if (timerActive) return;
    		timerActive = true;

    		$$invalidate(7, timer = setInterval(
    			() => {
    				if (timeLeft > 0) {
    					$$invalidate(1, timeLeft--, timeLeft);
    				} else {
    					clearInterval(timer); // Stop the timer when timeLeft reaches 0
    					calculateResults(); // Calculate results
    					timerActive = false;
    				}
    			},
    			1000
    		));
    	};

    	// Calculate WPM and Accuracy
    	const calculateResults = () => {
    		const wordsTyped = userText.trim().split(" ").length;
    		const correctChars = Array.from(userText).filter((char, idx) => char === testText[idx]).length;
    		const totalChars = testText.length;
    		$$invalidate(2, wpm = Math.round(wordsTyped / (30 - timeLeft) * 60)); // Words per minute
    		$$invalidate(3, accuracy = Math.round(correctChars / totalChars * 100)); // Accuracy percentage
    	};

    	// Reset the test
    	const resetTest = () => {
    		clearInterval(timer);
    		$$invalidate(0, userText = "");
    		$$invalidate(1, timeLeft = 30);
    		timerActive = false;
    		$$invalidate(2, wpm = 0);
    		$$invalidate(3, accuracy = 0);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function textarea_input_handler() {
    		userText = this.value;
    		$$invalidate(0, userText);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		testText,
    		userText,
    		timeLeft,
    		timerActive,
    		timer,
    		wpm,
    		accuracy,
    		startTimer,
    		calculateResults,
    		resetTest
    	});

    	$$self.$inject_state = $$props => {
    		if ('testText' in $$props) $$invalidate(4, testText = $$props.testText);
    		if ('userText' in $$props) $$invalidate(0, userText = $$props.userText);
    		if ('timeLeft' in $$props) $$invalidate(1, timeLeft = $$props.timeLeft);
    		if ('timerActive' in $$props) timerActive = $$props.timerActive;
    		if ('timer' in $$props) $$invalidate(7, timer = $$props.timer);
    		if ('wpm' in $$props) $$invalidate(2, wpm = $$props.wpm);
    		if ('accuracy' in $$props) $$invalidate(3, accuracy = $$props.accuracy);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*userText, timeLeft, timer*/ 131) {
    			// Reactive: Stop the timer when user completes the text
    			{
    				if (userText.trim() === testText.trim() && timeLeft > 0) {
    					clearInterval(timer); // Stop the timer
    					calculateResults(); // Calculate results
    					timerActive = false;
    				}
    			}
    		}
    	};

    	return [
    		userText,
    		timeLeft,
    		wpm,
    		accuracy,
    		testText,
    		startTimer,
    		resetTest,
    		timer,
    		textarea_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
