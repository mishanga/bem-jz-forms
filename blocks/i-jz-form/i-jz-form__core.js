var JZ = {

    CSS_CLASS_WIDGET : 'jz',

    onInit : function(elem, fn) {

        elem
            .bind('init.jz', fn)
            .each(function() {
                $(this).data('jz') && fn.call(window, $.Event('init.jz'), $(this).data('jz'));
            });

    },

    registerWidget : function(name, parentName, props, staticProps) {

        this.Builder.registerWidget(name, parentName, props, staticProps);
        return this;

    },

    getWidgetClassByType : function(type) {

        return this.Builder._getWidgetClassByType(type);

    },

    _throwException : function(text) {

        throw 'JZException: ' + text;

    },

    _identifyNode : function(node) {

        return node.id || ('__id-' + $.identify(node));

    }

};

$.fn.jz = function(add) {
    var result;
    this.each(function(i) {
        var elem = $(this), jz = elem.data('jz');
        if(add === false) {
            jz && jz.remove(true);
        }
        else if(!jz) {
            var form = elem.closest('form');
            if(form[0]) {
                var builder = form.data('jz-builder');
                (builder || new JZ.Builder()).build(builder? elem : form);
            }
        }
        i == 0 && (result = elem.data('jz'));
    });
    return result;
};JZ.Observable = $.inherit(/** @lends JZ.Observable.prototype */{

    /**
     * Добавляет обработчик событий
     * @param {String} type тип события/событий (включая неймспейсы)
     * @param {Object} [data] дополнительные данные (приходящие в обработчик как e.data)
     * @param {Function} fn обработчик
     * @param {Object} [ctx] контекст обработчика
     */
    bind : function(type, data, fn, ctx, undefined) {

        this._observers || (this._observers = {});

        var _this = this;
        if(typeof type == 'string') {
            if($.isFunction(data)) {
                ctx = fn;
                fn = data;
                data = undefined;
            }

            var i = 0, types = type.split(' '), typeNs, hasNs;
            while(typeNs = types[i++]) {
                hasNs = typeNs.indexOf('.') > -1;
                typeNs = hasNs? typeNs.split('.') : typeNs;
                type = hasNs? typeNs.shift() : typeNs;
                (_this._observers[type] || (_this._observers[type] = [])).push({
                    ns   : hasNs? typeNs.sort().join('.') : null,
                    fn   : fn,
                    data : data,
                    ctx  : ctx
                });
            }
        }
        else {
            $.each(type, function(type, fn) {
                _this.bind(type, fn, data);
            });
        }

        return this;

    },

    /**
     * Удаляет обработчики событий
     * @param {String} [type] Тип события/событий (включая неймспейсы)
     * @param {Function} [fn] Обработчик
     * @param {Function} [ctx] Контекст обработчика
     */
    unbind : function(type, fn, ctx) {

        if(this._observers) {
            if(type) {
                var i = 0, j, types = type.split(' '), observers, observer, typeNs, hasNs, ns;
                while(typeNs = types[i++]) {
                    hasNs = typeNs.indexOf('.') > -1;
                    typeNs = hasNs? typeNs.split('.') : typeNs;
                    type = hasNs? typeNs.shift() : typeNs;
                    ns = hasNs? new RegExp('(^|\\.)' + typeNs.sort().join('\\.(?:.*\\.)?') + '(\\.|$)') : null;
                    if(type) {
                        observers = this._observers[type];
                        if(observers) {
                            j = 0;
                            while(observer = observers[j++]) {
                                if((!fn || (fn === observer.fn && ctx === observer.ctx)) &&
                                   (!hasNs || (hasNs && observer.ns && ns.test(observer.ns)))) {
                                    observers.splice(--j, 1);
                                }
                            }
                        }
                    }
                    else {
                        for(type in this._observers) {
                            observers = this._observers[type];
                            j = 0;
                            while(observer = observers[j++]) {
                                if((!fn || fn === observer.fn && ctx === observer.ctx) && observer.ns && ns.test(observer.ns)) {
                                    observers.splice(--j, 1);
                                }
                            }
                        }
                    }
                }
            }
            else {
                delete this._observers;
            }
        }

        return this;

    },

    /**
     * Запускает обработчики события
     * @param {String|$.Event} e событие
     * @param {Object} data данные
     */
    trigger : function(e, data) {

        if(this._observers) {
            typeof e === 'string' && (e = $.Event(e));

            var hasNs = e.type.indexOf('.') > -1,
                ns = hasNs? e.type.split('.') : null;

            if(hasNs) {
                e.type = ns.shift();
                ns = new RegExp('(^|\\.)' + ns.sort().join('\\.(?:.*\\.)?') + '(\\.|$)');
            }

            var observers = this._observers[e.type];
            if(observers) {
                var i = 0, observer, ret;
                while(observer = observers[i++]) {
                    if(!hasNs || (observer.ns && ns.test(observer.ns))) {
                        e.data = observer.data;
                        ret = observer.fn.call(observer.ctx || window, e, data);
                        if(typeof ret !== 'undefined') {
                            e.result = ret;
                            if(ret === false) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        }
                    }
                }
            }
        }

        return this;

    }

});JZ.Widget = $.inherit(JZ.Observable, {

    __constructor : function(elem, classElem, params) {

        var _this = this;

        _this._elem = elem.data('jz', _this);
        _this._classElem = classElem || elem;
        _this._params = $.extend(_this._getDefaultParams(params), params);
        _this._parent = _this._form = null;
        _this._isInited = _this._isRequired = false;
        _this._isValid = true;
        _this._isEnabled = !_this._elem.attr('disabled');
        _this._isFocused = false;
        _this._val = _this._initialVal = null;
        _this._dependencies = {};
        _this._dependFromIds = {};

    },

    getElement : function() {

        return this._elem;

    },

    getId : $.memoize(function() {

        return JZ._identifyNode(this._elem[0]);

    }),

    getName : $.memoize(function() {

        return this._extractName();

    }),

    isFocusable : function() {

        return true;

    },

    focus : function() {

        this.isFocusable() && this._elem[0].focus();
        return this;

    },

    blur : function() {

        this._elem[0].blur();
        return this;

    },

    hasCSSClass : function(name) {

        return this._classElem.hasClass(name);

    },

    addCSSClass : function(name) {

        this._classElem.addClass(name);
        return this;

    },

    removeCSSClass : function(name) {

        this._classElem.removeClass(name);
        return this;

    },

    replaceCSSClass : function(nameFrom, nameTo) {

        this.hasCSSClass(nameFrom) && this.removeCSSClass(nameFrom);
        return this.addCSSClass(nameTo);

    },

    init : function(updateVal) {

        return this._isInited?
            this._reinit(updateVal) :
            this._init();

    },

    isRequired : function() {

        return this._isRequired;

    },

    isValid : function() {

        return this._isValid;

    },

    isReady : function() {

        return !this.isEnabled() || (!this.isRequired() && this.isValid());

    },

    isEnabled : function() {

        return this._isEnabled;

    },

    show : function() {

        return this.removeCSSClass(this.__self.CSS_CLASS_INVISIBLE);

    },

    hide : function() {

        return this.addCSSClass(this.__self.CSS_CLASS_INVISIBLE);

    },

    enable : function(byParent) {

        var _this = this;

        if(_this.isEnabled() || (_this._parent && !_this._parent.isEnabled())) {
            return _this;
        }

        if(byParent && _this._dependencies['enabled']) {
            return _this._checkDependencies('enabled');
        }

        _this._enableElems();
        var isReady = _this.removeCSSClass(_this.__self.CSS_CLASS_DISABLED).isReady();
        _this._isEnabled = true;
        isReady != _this.isReady() && _this.trigger('ready-change', _this);
        _this.isChanged() && _this.trigger('initial-value-change', true);
        return _this.trigger('enable', _this);

    },

    disable : function() {

        var _this = this;

        if(_this.isEnabled()) {
            _this._isFocused && this.blur();
            _this._disableElems();
            var isReady = _this.addCSSClass(_this.__self.CSS_CLASS_DISABLED).isReady();
            _this._isEnabled = false;
            isReady != _this.isReady() && _this.trigger('ready-change', _this);
            _this.isChanged() && _this.trigger('initial-value-change', false);
            _this.trigger('disable', _this);
        }

        return _this;

    },

    val : function(val) {

        return typeof val == 'undefined'?
               this._getVal().get() :
            this._setVal(this._processVal(this._createVal(val)));

    },

    /**
     * @deprecated use val() instead
     */
    getValue : function() {

        return this.val();

    },

    /**
     * @deprecated use val() instead
     * @param val
     */
    setValue : function(val) {

        return this.val(val);

    },

    addDependence : function(type, dependence) {

        var _this = this;
        $.each((_this._dependencies[type] = dependence).getFrom(), function() {
            if(!_this._dependFromIds[this.getId()]) {
                this
                    .bind('value-change enable disable', _this._onChangeDependFromWidget, _this)
                    .bind('remove', _this._onRemoveDependFromWidget, _this);
                _this._dependFromIds[this.getId()] = true;
            }
        });

    },

    remove : function(fromDOM) {

        this._triggerRemove()._parent && this._parent._removeChild(this);
        var classElem = this._classElem;
        this._destruct();
        fromDOM && classElem.remove();

    },

    reset : function() {

        if(this._hasVal()) {
            this._setNoReady(false);
            this._setVal(this._initialVal);
        }
        return this;

    },

    addChild : function() {},

    _bindTo : function(observable, type, data, fn) {

        if($.isFunction(data)) {
            fn = data;
            data = null;
        }

        var _this = this;
        typeof type == 'string'?
            observable.bind(type, data, $.proxy(fn, _this)) :
            $.each(type, function(type) {
                _this._bindTo(observable, type, data, this);
            });

        return _this;

    },

    _bindToElem : function(type, data, fn) {

        return this._bindTo(this._elem, type, data, fn);

    },

    _init : function() {

        this
            ._bindEvents()
            ._hasVal() && this._initVal();
        this._isInited = true;
        this._params.focusOnInit && this.focus();
        return this;

    },

    _reinit : function(updateVal) {

        if(this._hasVal()) {
            this._setNoReady(false);
            if(updateVal) {
                this.isChanged() && this.removeCSSClass(this.__self.CSS_CLASS_CHANGED);
                this._initialVal = this._val;
            }
        }
        return this;

    },

    _extractName : function() {

        return this._elem.attr('name');

    },

    _createVal : function(val) {

        return new JZ.Value(val);

    },

    _processVal : function(val) {

        return val;

    },

    _getVal : function() {

        return this._val;

    },

    _setVal : function(val, prevent) {

        var _this = this;

        if(!_this._val.isEqual(val)) {
            var isChanged = _this.isChanged();
            _this._val = val;
            prevent || _this._setValToElem(val);
            isChanged == _this.trigger('value-change', _this).isChanged() ||
                _this[(isChanged? 'remove' : 'add') + 'CSSClass'](_this.__self.CSS_CLASS_CHANGED)
                    .trigger('initial-value-change', !isChanged);
        }

        return _this;

    },

    _setForm : function(form) {

        (this._form = form)._addWidget(this);
        return this;

    },

    _getDefaultParams : function(params) {

        return {
            focusOnInit : false
        };

    },

    _del : function() {

        var _this = this;
        $.each(arguments, function(i, prop) {
            delete _this[prop];
        });

    },

    _destruct : function() {

        var _this = this;
        $.each(_this._dependencies, function() {
            var dependWidgets = this.getFrom(), dependWidget, i = 0;
            while(dependWidget = dependWidgets[i++]) {
                dependWidget
                    .unbind('value-change enable disable', _this._onChangeDependFromWidget, _this)
                    .unbind('remove', _this._onRemoveDependFromWidget, _this);
            }
        });

        this._unbindAll();

        this._elem.removeData('jz');

        this._del(
            '_elem', '_classElem', '_params', '_parent', '_form',
            '_val', '_initialVal', '_dependencies', '_dependFromIds');

    },

    _unbindAll : function() {

        this._elem.unbind();
        this._classElem.unbind();
        this.unbind();

    },

    _hasVal : function() {

        return false;

    },

    _initVal : function() {

        this._initialVal = (this._val = this._createVal(this._extractValFromElem())).clone();

    },

    isChanged : function() {

        return this._hasVal() && !this._initialVal.isEqual(this._val);

    },

    _updateVal : function() {

        this._setVal(this._createVal(this._extractValFromElem()), true);

    },

    _checkDependencies : (function() {

        var fullOrder = ['enabled', 'valid', 'required'];
        return function(onlyType, recursively, fullCheck) {
            var _this = this,
                i = 0, type, dependenciesByType, order = !!onlyType? [onlyType] : fullOrder,
                length = order.length, isReady = _this.isReady();
            while(i < length) {
                dependenciesByType = _this._dependencies[type = order[i++]];
                if(dependenciesByType || fullCheck)
                    _this[_this.__self._dependenceTypeToFn(type)](dependenciesByType?
                        dependenciesByType.check() :
                        { result : true, params : {} });
            }
            isReady != _this.isReady() && _this.trigger('ready-change', _this);
            return _this;
        };

    })(),

    _checkRequired : function(params) {

         return this._getVal().match(params.pattern);

    },

    _processEnabledDependenceCheck : function(check) {

        if(check.result) {
            var isEnabled = this.isEnabled();
            this
                .enable()
                .show();
            check.params.focusOnEnable && !isEnabled && this.focus();
        }
        else {
            this.disable();
            check.params.hideOnDisable && this.hide();
        }

    },

    _processRequiredDependenceCheck : function(check) {

        this._updateRequired(!check.result);

    },

    _processValidDependenceCheck : function(check) {

        this._updateValid(check.result);
        var _this = this,
            invalidCSSClasses = check.params.invalidCSSClasses;
        invalidCSSClasses && $.each(invalidCSSClasses, function() {
            _this[(this.add? 'add' : 'remove') + 'CSSClass'](this.name);
        });

    },

    _updateRequired : function(isRequired) {

        var _self = this.__self;
        (isRequired?
            this.replaceCSSClass(_self.CSS_CLASS_REQUIRED_OK, _self.CSS_CLASS_REQUIRED) :
            this
                .replaceCSSClass(_self.CSS_CLASS_REQUIRED, _self.CSS_CLASS_REQUIRED_OK)
                .removeCSSClass(_self.CSS_CLASS_NOREADY_REQUIRED))
            ._isRequired = isRequired;

    },

    _updateValid : function(isValid) {

        var _self = this.__self;
        (isValid?
            (this._getVal().isEmpty()?
                this.removeCSSClass(_self.CSS_CLASS_INVALID + ' ' + _self.CSS_CLASS_INVALID_OK) :
                this.replaceCSSClass(_self.CSS_CLASS_INVALID, _self.CSS_CLASS_INVALID_OK))
                .removeCSSClass(_self.CSS_CLASS_NOREADY_INVALID) :
            this.replaceCSSClass(_self.CSS_CLASS_INVALID_OK, _self.CSS_CLASS_INVALID))
            ._isValid = isValid;

    },

    _setNoReady : function(noReady) {

        var methodName = (noReady? 'add' : 'remove') + 'CSSClass';
        this.isRequired() && this[methodName](this.__self.CSS_CLASS_NOREADY_REQUIRED);
        this.isValid() || this[methodName](this.__self.CSS_CLASS_NOREADY_INVALID);

    },

    _processFirstUnreadyWidget : function() {

        if(!this.isReady()) {
            return this;
        }

    },

    _extractValFromElem : function() {

        return this._elem.val();

    },

    _setValToElem : function(val) {

        this._elem.val(val.toString());

    },

    _triggerRemove : function() {

        return this.trigger('remove', this);

    },

    _onChangeDependFromWidget : function() {

        this._checkDependencies();

    },

    _onRemoveDependFromWidget : function(event, widget) {

        var _this = this;
        $.each(this._dependencies, function(type) {
            var dependence = this.removeFrom(widget);
            dependence? _this._dependencies[type] = dependence : delete _this._dependencies[type];
            _this._checkDependencies(type, false, true);
        });
        delete this._dependFromIds[widget.getId()];

    },

    _bindEvents : function() {

        return this;

    },

    _enableElems : function() {},
    _disableElems : function() {},
    _beforeSubmit : function() {}

}, {

    CSS_CLASS_HIDDEN           : JZ.CSS_CLASS_WIDGET + '-hidden',
    CSS_CLASS_INVISIBLE        : JZ.CSS_CLASS_WIDGET + '-invisible',
    CSS_CLASS_INITED           : JZ.CSS_CLASS_WIDGET + '-inited',
    CSS_CLASS_CHANGED          : JZ.CSS_CLASS_WIDGET + '-changed',
    CSS_CLASS_FOCUSED          : JZ.CSS_CLASS_WIDGET + '-focused',
    CSS_CLASS_SELECTABLE       : JZ.CSS_CLASS_WIDGET + '-selectable',
    CSS_CLASS_SELECTED         : JZ.CSS_CLASS_WIDGET + '-selected',
    CSS_CLASS_DISABLED         : JZ.CSS_CLASS_WIDGET + '-disabled',
    CSS_CLASS_REQUIRED         : JZ.CSS_CLASS_WIDGET + '-required',
    CSS_CLASS_REQUIRED_OK      : JZ.CSS_CLASS_WIDGET + '-required-ok',
    CSS_CLASS_INVALID          : JZ.CSS_CLASS_WIDGET + '-invalid',
    CSS_CLASS_INVALID_OK       : JZ.CSS_CLASS_WIDGET + '-invalid-ok',
    CSS_CLASS_NOREADY_REQUIRED : JZ.CSS_CLASS_WIDGET + '-noready-required',
    CSS_CLASS_NOREADY_INVALID  : JZ.CSS_CLASS_WIDGET + '-noready-invalid',

    _dependenceTypeToFn : $.memoize(function(type) {

        return '_process' + type.charAt(0).toUpperCase() + type.substr(1).toLowerCase() + 'DependenceCheck';

    })

});JZ.Widget.Input = $.inherit(JZ.Widget, {

    _bindEvents : function() {

        return this
            ._bindToElem({
                'focus' : this._onFocus,
                'blur'  : this._onBlur
            });

    },

    _onFocus : function() {

        this
            .addCSSClass(this.__self.CSS_CLASS_FOCUSED)
            ._isFocused = true;
        this.trigger('focus');

    },

    _onBlur : function() {

        this
            .removeCSSClass(this.__self.CSS_CLASS_FOCUSED)
            ._isFocused = false;
        this.trigger('blur');

    },

    _hasVal : function() {

        return true;

    },

    _enableElems : function() {

        this._elem.attr('disabled', false);

    },

    _disableElems : function() {

        this._elem.attr('disabled', true);

    }

});JZ.Widget.Input.Text = $.inherit(JZ.Widget.Input, {

    __constructor : function() {

        this.__base.apply(this, arguments);
        this._hintShowed = false;

    },

    isFocusable : function() {

        return this._elem[0].type.toLowerCase() != 'hidden';

    },

    _init : function() {

        this.__base()._isFocused || this._updatePlaceholder();
        return this;

    },

    _bindEvents : function() {

        return this
            .__base()
            ._bindToElem('input change keyup blur', this._onChange);

    },

    _onFocus : function() {

        this.__base();
        this._updatePlaceholder();

    },

    _onBlur : function() {

        this.__base();
        this._updatePlaceholder();

    },

    _onChange : function() {

        this._updateVal();

    },

    _updatePlaceholder : function() {

        if(this._params.placeholder) {
            var showHint = this._hintShowed,
                isValEmpty = this._getVal().isEmpty();
            this._hintShowed?
                (this._isFocused || !isValEmpty) && (showHint = false) :
                (!this._isFocused && isValEmpty) && (showHint = true);
            showHint != this._hintShowed &&
                this._getPlaceholder()[((this._hintShowed = showHint)? 'remove' : 'add') + 'Class'](this.__self.CSS_CLASS_HIDDEN);
        }

    },

    _setValToElem : function() {

        this._updatePlaceholder();
        this.__base.apply(this, arguments);

    },

    _getPlaceholder : $.memoize(function() {

        return $('<label for="' + this.getId() + '" class="' + this.__self.CSS_CLASS_PLACEHOLDER + '">' +
            this._params.placeholder + '</label>')
            .insertBefore(this._elem.attr('id', this.getId()));

    }),

    _destruct : function() {

        this._params.placeholder && this._getPlaceholder().remove();
        this.__base();

    }

}, {

    CSS_CLASS_PLACEHOLDER : JZ.CSS_CLASS_WIDGET + '-placeholder'

});JZ.Widget.Input.Text.Number = $.inherit(JZ.Widget.Input.Text, {

    __constructor : function() {

        this.__base.apply(this, arguments);
        this._hiddenElem = this._keyDownCode = null;
        this._keyDownAllowed = false;

    },

    _createVal : function(val) {

        return new JZ.Value.Number(val);

    },

    _init : function() {

        var elem = this.__base()._elem;
        elem.after(this._hiddenElem = $('<input type="hidden" value="' + elem.val() + '"' +
            (elem.attr('id')? ' id="value-' + elem.attr('id') + '"' : '') + '/>'));
        if(elem.attr('name')) {
            this._hiddenElem.attr('name', elem.attr('name'));
            elem.removeAttr('name');
        }
        this._checkElemValue();
        return this;

    },

    _extractName : function() {

        return (this._hiddenElem || this._elem).attr('name');

    },

    _bindEvents : function() {

        return this
            .__base()
            ._bindToElem({
                'keydown'  : this._onKeyDown,
                'keypress' : this._onKeyPress
            });

    },

    _onBlur : function() {

        this.__base();
        this._checkElemValue();

    },

    _checkElemValue : function() {

        this._elem.val() != this._getVal().toString() && this._elem.val(this._getVal().toString());

    },

    _onKeyDown : function(e) {

        this._keyDownCode = e.keyCode;

        return this._keyDownAllowed = e.ctrlKey || e.metaKey ||
            (e.keyCode > 47 && e.keyCode < 58) ||
            (e.keyCode > 95 && e.keyCode < 106) ||
            $.inArray(e.keyCode, [190, 189, 188, 109, 46, 45, 39, 37, 36, 35, 9, 8, 13]) > -1;

    },

    _onKeyPress : function(e) {

        if(e.charCode === 0 || (this._keyDownCode === e.keyCode && $.inArray(e.keyCode, [45, 46]) > -1)) {
            return true;
        }

        if(!this._keyDownAllowed) {
            return false;
        }

        var keyCode = e.keyCode || e.charCode;

        if($.inArray(keyCode, [44, 45, 46]) == -1) {
            return true;
        }

        var selection = this._elem.getSelection();
        if(this._params.allowNegative && keyCode == 45) {
            return (this._elem.val().charAt(0) != '-' && selection.start == 0) ||
                   selection.text.indexOf('-') > -1;
        }

        return this._params.allowFloat && ((!/\.|\,/.test(this._elem.val()) &&
               (this._elem.val().charAt(0) != '-' || selection.start > 0 || selection.text.indexOf('-') > -1)) ||
               selection.text.indexOf('.') > -1 || selection.text.indexOf(',') > -1);

    },

    _setVal : function(val, prevent) {

        this._hiddenElem.val(val.get());
        return this.__base(val, prevent);

    },

    _enableElems : function() {

        this.__base();
        this._hiddenElem && this._hiddenElem.attr('disabled', false);

    },

    _disableElems : function() {

        this.__base();
        this._hiddenElem && this._hiddenElem.attr('disabled', true);

    },

    _getDefaultParams : function() {

        return $.extend(this.__base(), {
            allowNegative : false,
            allowFloat    : false
        });

    },

    _destruct : function() {

        this._hiddenElem.attr('name') && this._elem.attr('name', this._hiddenElem.attr('name'));
        this._hiddenElem.remove();
        this._hiddenElem = null;

        this.__base();

    }

});JZ.Widget.Input.Text.Combo = $.inherit(JZ.Widget.Input.Text, {

    __constructor : function() {

        var _this = this;

        _this.__base.apply(_this, arguments);

        _this._isListShowed = _this._preventOnBlur = _this._preventOnFocus =
            _this._preventUpdate = _this._focusOnBlur = false;
        _this._hiddenElem = _this._items = _this._lastSearchVal = _this._keyDownValue =
            _this._updateList = _this._reposTimer = _this._lastOffset = null;
        _this._hilightedIndex = -1;

    },

    _init : function() {

        var _this = this,
            elem = _this.__base()._elem.attr('autocomplete', 'off');

        elem.after(_this._hiddenElem = $('<input type="hidden" value="' + elem.val() + '"' +
            (elem.attr('id')? ' id="value-' + elem.attr('id') + '"' : '') + '/>'));
        if(elem.attr('name')) {
            _this._hiddenElem.attr('name', elem.attr('name'));
            elem.removeAttr('name');
        }

        _this._params.arrow && _this._params.arrow.attr('tabIndex', -1);
        _this._updateArrow();

        _this._updateList = $.debounce(function(val) {

            if(_this._elem) { // widget not destructed
                if(!_this._params.showListOnEmpty && _this._elem.val() === '') {
                    return _this._hideList();
                }
                var searchVal = typeof val == 'undefined'? _this._elem.val() : val;
                _this._getStorage().filter(_this._lastSearchVal = searchVal, $.proxy(_this._onStorageFilter, _this));
            }

        }, _this._params.debounceInterval);

        return _this;

    },

    _extractName : function() {

        return (this._hiddenElem || this._elem).attr('name');

    },

    _createVal : function(val, preventMapping) {

        return this.__base(preventMapping? val : this._getValMapper().toVal(val));

    },

    _setVal : function(val, prevent) {

        this._hiddenElem.val(val.toString());

        return this.__base(val, prevent);

    },

    _setValToElem : function(val) {

        this.__base(this._createVal(this._getValMapper().toString(val), true));

    },

    _onStorageFilter : function(searchVal, list) {

        var _this = this;
        if(_this._lastSearchVal == searchVal) {
            _this._items = list;
            _this._hilightedIndex = -1;

            if(!list.length) {
                return _this._hideList();
            }

            var listElem = _this._getList(),
                itemProcessor = _this._getItemProcessor(),
                html = [],
                i = 0, item, len = list.length,
                isSelected;

            while(i < len) {
                item = list[i];
                html.push('<li');
                itemProcessor.isSelectable(item) && html.push(' class="', this.__self.CSS_CLASS_SELECTABLE, '"');
                html.push(' onclick="return ', i++, '"');
                if(isSelected = itemProcessor.isSelected(item, searchVal)) {
                    _this._hilightedIndex = i - 1;
                }
                html.push('>');
                itemProcessor.toHtml(item, searchVal, html);
                html.push('</li>');
            }

            listElem
                .html(html.join(''))
                .css({ overflow : 'hidden', height : 'auto', width : 'auto' });

            _this._showList();

            var css = {
                overflow : 'auto',
                width    : Math.max(
                    listElem.outerWidth(),
                    _this._elem.outerWidth() - parseInt(listElem.parent().css('border-left-width'), 10) * 2)
            };

            list.length > _this._params.listSize &&
                (css.height = listElem.find('li:first').outerHeight() * _this._params.listSize);

            listElem.css(css);

            _this._hilightedIndex > -1?
                _this._hilightItemByIndex(_this._hilightedIndex) :
                listElem.scrollTop(0);

        }

    },

    _bindEvents : function() {

        var _this = this,
            keyDown = $.browser.opera? 'keypress' : 'keydown',
            keyBinds = { 'keyup' : _this._onKeyUp },
            arrow = _this._params.arrow;

        keyBinds[keyDown] = _this._onKeyDown;
        _this
            .__base()
            ._bindToElem(keyBinds);

        arrow && _this
            ._bindTo(arrow, {
                'mousedown' : _this._onArrowMouseDown,
                'mouseup'   : _this._onArrowMouseUp,
                'click'     : _this._onArrowClick
            });

        return _this;

    },

    _onFocus : function() {

        var _this = this;
        if(_this._preventOnFocus) {
            _this._preventOnFocus = false;
        }
        else {
            _this.__base();
            if(_this._preventUpdate) {
                _this._preventUpdate = false;
            }
            else {
                if(_this._params.showAllOnFocus) {
                    _this._updateList('');
                    _this._lastSearchVal = _this._elem.val();
                }
                else {
                    _this._updateList();
                }
            }
        }

    },

    _onBlur : function() {

        var _this = this;
        if(_this._preventOnBlur) {
            _this._preventOnBlur = false;
        }
        else {
            _this.__base();
            _this._hideList();
        }

        if(_this._focusOnBlur) {
            _this._preventUpdate = true;
            _this._focusOnBlur = false;
            setTimeout(function() {
                _this._refocus();
            }, 0);
        }

    },

    _onSelect : function() {

        this.trigger('select', this);

    },

    _onArrowMouseDown : function() {

        if(this.isEnabled()) {
            this._preventOnBlur = true;
            this._params.arrow.addClass(this.__self.CSS_CLASS_ARROW_PRESSED);
        }

    },

    _onArrowMouseUp : function() {

        this.isEnabled() &&
            this._params.arrow.removeClass(this.__self.CSS_CLASS_ARROW_PRESSED);

    },

    _onArrowClick : function(e) {

        e.preventDefault();

        var _this = this;
        if(_this.isEnabled()) {
            if(_this._isListShowed && !_this._lastSearchVal) {
                _this
                    ._hideList()
                    ._preventOnFocus = true;
                _this.focus();
            }
            else {
                _this._preventUpdate = true;
                _this
                    ._refocus()
                    ._updateList('');
                _this._preventOnBlur = false;
            }
        }

    },

    _onKeyDown : function(e) {

        var _this = this;

        _this._keyDownValue === null && (_this._keyDownValue = _this._elem.val());

        if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
            return;
        }
        switch(e.keyCode) {
            case 13:
                return _this._onEnter();

            case 38:
                _this._next(-1);
                return false;

            case 40:
                _this._next(1);
                return false;
        }

    },

    _onKeyUp : function(e) {

        if(!this._isFocused || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
            return;
        }

        e.keyCode != 9 && this._keyDownValue !== null && this._keyDownValue != this._elem.val() && this._updateList();
        this._keyDownValue = null;

    },

    _onEnter : function() {

        var _this = this;
        if(_this._isListShowed) {
            _this._params.blurOnSelect && this.blur();
            _this
                ._setVal(this._createVal(_this._lastSearchVal = _this._keyDownValue))
                ._hideList()
                ._onSelect();
            return false;
        }

    },

    _next : function(direction) {

        if(this._isListShowed) {
            var itemProcessor = this._getItemProcessor(),
                i = this._hilightedIndex,
                len = this._items.length;

            do {
                i += direction;
                if(i == len) {
                    i = 0;
                }
                else if(i == -1) {
                    i = len - 1;
                }

                if(itemProcessor.isSelectable(this._items[i])) {
                    return this._hilightItemByIndex(i);
                }
            }
            while(i != this._hilightedIndex);
        }

    },

    _hilightItemByIndex : function(index) {

        var _this = this,
            listElem = _this._getList(),
            itemElems = listElem.find('li').eq(_this._hilightedIndex)
                .removeClass(_this.__self.CSS_CLASS_SELECTED)
                .end(),
            hilightedElem = itemElems.eq(_this._hilightedIndex = index).addClass(_this.__self.CSS_CLASS_SELECTED),
            itemHeight = hilightedElem.outerHeight(),
            topIndex = Math.ceil(listElem.scrollTop() / itemHeight),
            newTopIndex = topIndex;

        if(index >= topIndex + _this._params.listSize) {
            newTopIndex = index + 1 - _this._params.listSize;
        }
        else if(index < topIndex) {
            newTopIndex = index;
        }

        topIndex == newTopIndex || listElem.scrollTop(itemHeight * newTopIndex);

        _this
            ._selectItemByIndex(index)
            ._keyDownValue = _this._elem.val();

    },

    _selectItemByIndex : function(index) {

        var _this = this;

        if(_this._isListShowed) {
            var item = _this._items[index];
            if(item) {
                _this._onSelectItem(item, _this._lastSearchVal = _this._getItemProcessor().val(item));
                var node = _this._elem[0];
                if(node.createTextRange && !node.selectionStart) {
                    var range = node.createTextRange();
                    range.move('character', this._elem.val().length);
                    range.select();
                }
            }
        }

        return this;

    },

    _onSelectItem : function(item, val) {

        this._setVal(this._createVal(val));

    },

    _showList : function() {

        var _this = this;
        if(_this._isListShowed || !_this._isFocused || !_this._items.length) {
            return _this;
        }

        _this._getListContainer().removeClass(_this.__self.CSS_CLASS_INVISIBLE);
        _this._reposList();
        _this._isListShowed = true;

        return _this;

    },

    _hideList : function() {

        var _this = this;
        if(_this._isListShowed) {
            _this._reposTimer && clearTimeout(_this._reposTimer);
            _this._getListContainer().addClass(_this.__self.CSS_CLASS_INVISIBLE);
            _this._isListShowed = false;
        }

        return _this;

    },

    _reposList : function() {

        var _this = this,
            offset = _this._elem.offset(),
            offsetLeft = offset.left,
            offsetTop = offset.top + _this._elem.outerHeight();

        if(!(_this._lastOffset && _this._lastOffset.left == offsetLeft && _this._lastOffset.top == offsetTop)) {
            _this._lastOffset = { left : offsetLeft, top : offsetTop };
            _this._getListContainer()
                .css({
                    left : offsetLeft + 'px',
                    top  : offsetTop + 'px'
                });
        }

        _this._params.reposList && (_this._reposTimer = setTimeout($.proxy(_this._reposList, _this), 50));

    },

    _getListContainer : $.memoize(function() {

        var _this = this,
            res = $('<div class="' + _this.__self.CSS_CLASS_LIST + ' ' + _this.__self.CSS_CLASS_INVISIBLE + '">' +
                   (this._params.useIframeUnder? '<iframe frameborder="0" tabindex="-1" src="javascript:void(0)"/>' : '') +
                '<ul/></div>');

        _this._bindTo(res, 'mousedown', function(e) {
            var itemNode = $(e.target).closest('li')[0];
            if(itemNode && $(itemNode).hasClass(_this.__self.CSS_CLASS_SELECTABLE)) {
                _this
                    ._selectItemByIndex(itemNode.onclick())
                    ._hideList()
                    ._onSelect();
                _this._focusOnBlur = !_this._params.blurOnSelect;
                _this._params.blurOnSelect && _this.blur();
            } else {
                _this._preventOnBlur = _this._focusOnBlur = _this._preventUpdate = true;
            }

            _this._focusOnBlur && setTimeout(function() {
                _this._focusOnBlur = _this._preventUpdate  = false;
            }, 50);

            return !_this._focusOnBlur;
        });

        return res.appendTo('body');

    }),

    _getList : $.memoize(function() {

        return this._getListContainer().find('ul');

    }),

    _getItemProcessor : $.memoize(function() {

        var itemProcessor = this._params.itemProcessor,
            defaultItemProcessor = this.__self._itemProcessor;
        return new (itemProcessor === defaultItemProcessor?
            itemProcessor :
            $.inherit(defaultItemProcessor, itemProcessor))(this._params.caseSensitivity);

    }),

    _getValMapper : $.memoize(function() {

        var valMapper = this._params.valMapper,
            defaultValMapper = this.__self._valMapper;
        return new (valMapper === defaultValMapper?
            valMapper :
            $.inherit(defaultValMapper, valMapper))(this);

    }),

    _getStorage : function() {

        var _this = this;

        if(_this._storage) {
            return _this._storage;
        }

        var params = $.extend({
                name : _this._params.storage.name || _this.getName(),
                widgets : $.map((_this._params.storage.values || '').split(','), function(name) {
                    name = $.trim(name);
                    return name? _this._form.getWidgetByName(name) : null;
                })
            }, _this._params.storage),
            source = _this._params.storage.source;

        return _this._storage =  typeof source == 'string'?
            (_this._params.storage.source == 'remote'?
                new JZ.Storage.Remote(params) :
                new JZ.Storage.Local(params)) :
            new source(params);

    },

    setStorage : function(storage) {

        this._storage = storage;
        this._updateArrow();
        this._isFocused && this._updateList(this._params.showAllOnFocus? '' : undefined);

    },

    _refocus : function() {

        var elem = this._elem[0],
            len = elem.value.length;

        elem.focus();

        if($.browser.opera) {
            elem.setSelectionRange(len, len);
        }
        else if(elem.createTextRange) {
            var range = elem.createTextRange();
            range.move('character', len);
            range.select();
        }

        return this;

    },

    _enableElems : function() {

        this.__base();
        this._enableArrow(true);
    },

    _disableElems : function() {

        this.__base();
        this
            ._hideList()
            ._enableArrow(false);

    },

    _enableArrow : function(enable) {

        var arrowElem = this._params.arrow;
        arrowElem &&
            (arrowElem[(enable? 'remove' : 'add') + 'Class'](this.__self.CSS_CLASS_ARROW_DISABLED))[0].tagName == 'INPUT' &&
            arrowElem.attr('disabled', !enable);

    },

    _updateArrow : function() {

        var arrowElem = this._params.arrow;
        arrowElem && arrowElem[(this._getStorage().isEmpty()? 'add' : 'remove') + 'Class'](this.__self.CSS_CLASS_HIDDEN);

    },

    _getDefaultParams : function(params) {

        return $.extend(this.__base(), {
            listSize         : 15,
            showAllOnFocus   : false,
            showListOnEmpty  : true,
            blurOnSelect     : false,
            reposList        : false,
            debounceInterval : params.storage.source == 'remote'? 200 : 50,
            itemProcessor    : this.__self._itemProcessor,
            valMapper        : this.__self._valMapper,
            caseSensitivity  : false,
            useIframeUnder   : $.browser.msie && $.browser.version == 6
        });

    },

    _destruct : function() {

        this._hiddenElem.attr('name') && this._elem.attr('name', this._hiddenElem.attr('name'));
        this._hiddenElem.remove();
        this._hiddenElem = null;

        var listContainer = this._getListContainer();
        this
            ._hideList()
            .__base();
        listContainer.remove();

    },

    _unbindAll : function() {

        this.__base();
        this._params.arrow && this._params.arrow.unbind();

    }

}, {

    CSS_CLASS_LIST           : JZ.CSS_CLASS_WIDGET + '-list',
    CSS_CLASS_ARROW_PRESSED  : JZ.CSS_CLASS_WIDGET + '-comboarrow-pressed',
    CSS_CLASS_ARROW_DISABLED : JZ.CSS_CLASS_WIDGET + '-comboarrow-disabled',

    _itemProcessor : $.inherit({

        __constructor : function(caseSensitivity) {

            this._caseSensitivity = caseSensitivity;

        },

        toHtml : function(item, searchVal, buffer) {

            var val = this.val(item);

            if(this.isSelectable(item)) {
                var startIndex = (this._caseSensitivity? val : val.toLowerCase())
                        .indexOf((this._caseSensitivity? searchVal : searchVal.toLowerCase())),
                    searchValLen = searchVal.length;

                startIndex > -1?
                    buffer.push(
                        val.substr(0, startIndex),
                        '<strong>',
                        val.substr(startIndex, searchValLen),
                        '</strong>',
                        val.substr(startIndex + searchValLen)) :
                    buffer.push(val);
            }
            else {
                buffer.push(val);
            }

        },

        val : function(item) {

            return item;

        },

        isSelectable : function(item) {

            return true;

        },

        isSelected : function(item, searchVal) {

            if(!this.isSelectable(item)) {
                return false;
            }

            var val = this.val(item);
            return (this._caseSensitivity? val : val.toLowerCase()) ===
                   (this._caseSensitivity? searchVal : searchVal.toLowerCase());

        }

    }),

    _valMapper : $.inherit({

        toVal : function(str) {

            return str;

        },

        toString : function(val) {

            return val;

        }

    })

});
JZ.Widget.Input.Select = $.inherit(JZ.Widget.Input, {

    _bindEvents : function() {

        return this
            .__base()
            ._bindToElem('change', this._onChange);

    },

    _onChange : function() {

        this._updateVal();

    },

    _processVal : function(val) {

        var clone = this._elem.clone();
        clone.val(val.get()) !== val.get() && val.set(clone.val());
        return val;

    }

});JZ.Widget.Input.State = $.inherit(JZ.Widget.Input, {

    _bindEvents : function() {

        return this
            .__base()
            ._bindToElem('click', this._onChange);

    },

    _onChange : function() {

        this.trigger('value-change', this);

    },

    _checkDependencies : function() {

        return this;

    },

    _setChecked : function(checked) {

        this._elem.attr('checked', checked);
        this[(checked? 'add' : 'remove') + 'CSSClass'](this.__self.CSS_CLASS_CHECKED);

    },

    _isChecked : function() {

        return this._elem.attr('checked');

    },

    _hasVal : function() {

        return false;

    }

}, {

    CSS_CLASS_CHECKED : JZ.CSS_CLASS_WIDGET + '-checked'

});JZ.Widget.Button = $.inherit(JZ.Widget, {

    _bindEvents : function() {

        return this
            .__base()
            ._bindToElem('click', this._onClick);


    },

    _onClick : function(e) {

        this.trigger('click', { originalEvent : e });

    },

    _enableElems : function() {

        this._elem.attr('disabled', false);

    },

    _disableElems : function() {

        this._elem.attr('disabled', true);

    }

});JZ.Widget.Button.Submit = $.inherit(JZ.Widget.Button, {

    reset : function() {

        return this
            .__base()
            ._updateState();

    },

    _setForm : function(form) {

        return this.__base(form)._params.disableOnNoReady?
            this._bindTo(form, 'ready-change', this._updateState) :
            this.enable();

    },

    _reinit : function() {

        return this
            .__base()
            ._updateState();

    },

    _updateState : function() {

        return this[this._form.isReady() || !this._params.disableOnNoReady? 'enable' : 'disable']();

    },

    _getDefaultParams : function() {

        return {
            disableOnNoReady : true,
            disableOnSubmit  : true
        };

    },

    _beforeSubmit : function() {

        this._params.disableOnSubmit && this.disable();

    },

    _checkDependencies : function() {

        return this;

    }

});JZ.Widget.Container = $.inherit(JZ.Widget, {

    __constructor : function() {

        this.__base.apply(this, arguments);

        this._children = [];

    },

    addChild : function() {

        var i = 0, child;
        while(child = arguments[i++]) {
            (child._parent = this)._children.push(child);
        }
        return this;

    },

    isFocusable : function() {

        var children = this._children, i = 0, child;
        while(child = children[i++]) {
            if(child.isFocusable()) {
                return true;
            }
        }

        return false;

    },

    focus : function() {

        var children = this._children, i = 0, child;
        while(child = children[i++]) {
            if(child.isFocusable()) {
                child.focus();
                break;
            }
        }

        return this;

    },

    blur : function() {

        return this
            .__base()
            ._applyFnToChildren('blur');

    },

    enable : function(byParent) {

        return this
            .__base(byParent)
            ._applyFnToChildren('enable', [true]);

    },

    disable : function() {

        return this
            .__base()
            ._applyFnToChildren('disable');

    },

    reset : function() {

        return this
            .__base()
            ._applyFnToChildren('reset');

    },

    _removeChild : function(widget) {

        var children = this._children, i = 0, child;
        while(child = children[i++]) {
            if(child === widget) {
                children.splice(i - 1, 1);
                return true;
            }
        }
        return false;

    },

    _init : function() {

        this
            ._applyFnToChildren('_init')
            .__base();

        var children = this._children, i = 0, child;
        while(child = children[i++]) {
            this._bindChildEvents(child);
        }
        return this;

    },

    _reinit : function(updateVal) {

        return this
            ._applyFnToChildren('_reinit', [updateVal])
            .__base(updateVal);

    },

    _bindChildEvents : function(widget) {

        this._hasVal() || this._bindTo(widget, 'value-change enable disable', this._onChildChange);

    },

    _onChildChange : function() {

        this.trigger('value-change', this);

    },

    _setForm : function(form) {

        return this
            ._applyFnToChildren('_setForm', arguments)
            .__base(form);

    },

    _checkDependencies : function(onlyType, recursively) {

        this.__base(onlyType, recursively);
        recursively && this._applyFnToChildren('_checkDependencies', arguments);
        return this;

    },

    _beforeSubmit : function() {

        this
            ._applyFnToChildren('_beforeSubmit')
            .__base();

    },

    _checkRequired : function(params) {

        if(this._hasVal()) {
            return this.__base(params);
        }

        var children = this._children, i = 0, child, countUnrequiredChild = 0;
        while(child = children[i++]) {
            if(child._dependencies['required']) {
                child.isRequired() || ++countUnrequiredChild;
            }
            else {
                var pattern = params.pattern;
                params.pattern = params.patternChild;
                child._checkRequired(params) && ++countUnrequiredChild;
                params.pattern = pattern;
            }
            if(countUnrequiredChild >= params.min) {
                return true;
            }
        }
        return false;

    },

    _processFirstUnreadyWidget : function() {

        var baseResult = this.__base();
        return baseResult || this._hasVal()?
            baseResult :
            this._processFirstUnreadyChildWidget();

    },

    _processFirstUnreadyChildWidget : function() {

        var children = this._children, i = 0, child, unreadyWidget;
        while(child = children[i++]) {
            if(unreadyWidget = child._processFirstUnreadyWidget()) {
                return unreadyWidget;
            }
        }

    },

    _destruct : function() {

        this
            ._applyFnToChildren('_destruct')
            .__base();

        delete this._children;

    },

    _triggerRemove : function() {

        return this
            ._applyFnToChildren('_triggerRemove')
            .__base();

    },

    _applyFnToChildren : function(name, args) {

        var children = this._children, i = 0, child;
        while(child = children[i++]) {
            child[name].apply(child, args || []);
        }
        return this;

    }

});JZ.Widget.Container.StateGroup = $.inherit(JZ.Widget.Container, {

    addChild : function(widget) {

        var index = this.__base(widget)._children.length - 1;
        this._bindTo(widget, 'value-change', function() {
            this._onChildChange(widget, index);
        });

    },

    _hasVal : function() {

        return true;

    },

    _extractName : function() {

        var firstChild = this._children[0];
        return firstChild? firstChild.getName() : null;

    },

    _onChildChange : function() {}

});JZ.Widget.Container.StateGroup.CheckBoxes = $.inherit(JZ.Widget.Container.StateGroup, {

    _createVal : function(val) {

        return new JZ.Value.Multiple(val);

    },

    _onChildChange : function(widget, index) {

        this._children[index]._setChecked(widget._isChecked());
        this._updateVal();

    },

    _extractValFromElem : function() {

        var result = [], children = this._children, child, i = 0;
        while(child = children[i++]) {
            child.isEnabled() && child._isChecked() && result.push(child._elem.val());
        }
        return result;

    },

    _setValToElem : function(value) {

        var children = this._children, child, i = 0;
        while(child = children[i++]) {
            child.isEnabled() && child._setChecked(value.isContain(child._elem.val()));
        }

    },

    _checkRequired : function(params) {

         return $.grep(this._children, function(child) {
             return child.isEnabled() && child._isChecked();
         }).length >= params.min;

    }

});JZ.Widget.Container.StateGroup.RadioButtons = $.inherit(JZ.Widget.Container.StateGroup, {

    __constructor : function() {

        this.__base.apply(this, arguments);
        this._checkedIndex = -1;

    },

    addChild : function(widget) {

        this.__base.apply(this, arguments);
        widget._isChecked() && (this._checkedIndex = this._children.length - 1);

    },

    focus : function() {

        this._checkedIndex > -1?
            this._children[this._checkedIndex].focus() :
            this.__base();

        return this;

    },

    _onChildChange : function(widget, index) {

        var children = this._children;
        this._checkedIndex > -1 && children[this._checkedIndex]._setChecked(false);
        children[this._checkedIndex = index]._setChecked(true);
        this._updateVal();

    },

    _extractValFromElem : function() {

        var checkedIndex = this._checkedIndex;
        return checkedIndex > -1? this._children[checkedIndex]._elem.val() : '';

    },

    _setValToElem : function(val) {

        val = val.get();

        var children = this._children, child, i = 0;
        while(child = children[i++]) {
            if(val === child._elem.val()) {
                this._checkedIndex = i - 1;
                return child._setChecked(true);
            }
            else if(child._isChecked()) {
                child._setChecked(false);
            }
        }
        this._checkedIndex = -1;

    }

});JZ.Widget.Container.Date = $.inherit(JZ.Widget.Container, {

    __constructor : function() {

        this.__base.apply(this, arguments);
        this._yearInput = this._monthInput = this._dayInput = this._oldElem = null;

    },

    reset : function() {

        return JZ.Widget.prototype.reset.call(this);

    },

    _init : function() {

        var elem = $('<input type="hidden" name="' + this.getName() + '" value="' + this._elem.val() + '"/>')
            .data('jz', this);
        this._elem.replaceWith(elem);
        this._oldElem = this._elem;
        this._elem = elem;
        this._addChildInputs();
        return this.__base();

    },

    _addChildInputs : function() {

        this.addChild(
            this._yearInput = this._createNumberInput('year', 4),
            this._monthInput = this._createSelectInput('month'),
            this._dayInput = this._createNumberInput('day'));

    },

    _createNumberInput : function(postfix, size) {

        size = size || 2;
        return new JZ.Widget.Input.Text.Number(
            $('<input' +
                (this._params.onlyMonths && postfix == 'day'? ' type="hidden"' : '') +
                ' class="' + JZ.CSS_CLASS_WIDGET + '-' + postfix + '" ' +
                ' size="' + size + '"' +
                ' maxlength="' + size + '"/>').insertAfter(this._elem));

    },

    _createSelectInput : function(postfix) {

        return new JZ.Widget.Input.Select(
            $('<select' +
                ' class="' + JZ.CSS_CLASS_WIDGET + '-' + postfix + '">' +
                    $.map(JZ.Resources.getMonthsByType(this._params.onlyMonths? 'normal' : 'genitive'), function(name, i) {
                        return '<option value="' + (i + 1) + '">' + name +'</option>';
                    }).join('') +
                '</select>').insertAfter(this._elem));

    },

    _bindChildEvents : function(widget) {

        this
            ._bindTo(widget, {
                'value-change' : this._onChildChange,
                'blur'         : this._onChildBlur
            });

    },

    _onChildChange : function() {

        this._setVal(this._createVal(
            this._yearInput.val() + '-' + this._monthInput.val() + '-' + this._dayInput.val()), true);

    },

    _onChildBlur : function() {

        this._getVal().isEmpty() || this._updateChildValues();

    },

    _updateChildValues : function(val) {

        val = val || this._getVal();

        var widgets = [this._yearInput, this._monthInput, this._dayInput],
            vals = [val.getYear(), val.getMonth(), val.getDay()];
        $.each(widgets, function(i) {
            this.val() != vals[i] && this.val(vals[i]);
        });

        return val;

    },

    _initVal : function() {

        this.__base();
        this._setValToElem(this._getVal());

    },

    _setValToElem : function(val) {

        this._updateChildValues(val);
        return this.__base(val);

    },

    _hasVal : function() {

        return true;

    },

    _createVal : function(val) {

        return new JZ.Value.Date(val);

    },

    _getDefaultParams : function() {

        return $.extend(this.__base(), {
            onlyMonths : false
        });

    },

    _destruct : function() {

        this._applyFnToChildren('remove', [true]);
        this._elem.replaceWith(this._oldElem);
        this._elem = this._oldElem.val(this._elem.val());
        JZ.Widget.prototype._destruct.call(this);

    }

});JZ.Widget.Container.Date.Time = $.inherit(JZ.Widget.Container.Date, {

    __constructor : function() {

        this.__base.apply(this, arguments);
        this._hourInput = this._minuteInput = this._secondInput = null;

    },

    _addChildInputs : function() {

        this
            .addChild(
                this._secondInput = this._createNumberInput('second'),
                this._minuteInput = this._createNumberInput('minute'),
                this._hourInput = this._createNumberInput('hour'))
            .__base();

    },

    _onChildChange : function() {

        this._setVal(this._createVal(
            this._yearInput.val() + '-' + this._monthInput.val() + '-' + this._dayInput.val() + ' ' +
            this._hourInput.val() + ':' + this._minuteInput.val() + ':' + this._secondInput.val()), true);

    },

    _updateChildValues : function(val) {

        val = this.__base(val);

        var widgets = [this._hourInput, this._minuteInput, this._secondInput],
            vals = [val.getHour(), val.getMinute(), val.getSecond()];
        $.each(widgets, function(i) {
            this.val() != vals[i] && this.val(vals[i]);
        });

    },

    _createVal : function(val) {

        return new JZ.Value.Date.Time(val);

    }

});JZ.Widget.Container.Form = $.inherit(JZ.Widget.Container, {

    __constructor : function() {

        this.__base.apply(this, arguments);

        this._widgetsByName = {};
        this._widgetsDataById = {};
        this._unreadyWidgetIds = {};
        this._unreadyCounter = this._changedCounter = 0;
        this._submitted = false;

    },

    isChanged : function() {

        return this._changedCounter > 0;

    },

    isReady : function() {

        return this._unreadyCounter == 0 && (!this._params.heedChanges || this.isChanged());

    },

    getWidgetByName : function(name) {

        return this._widgetsByName[name];

    },

    getWidgetById : function(id) {

        return this._widgetsDataById[id].widget;

    },

    serialize : function() {

        var result = {};
        $.each(this._widgetsByName, function(name) {
            this._hasVal() && this.isEnabled() && (result[name] = this.val());
        });
        return result;

    },

    submit : function() {

        this._elem.submit();

    },

    init : function(updateVal, widget) {

        widget?
            widget
                ._setForm(this)
                ._init()
                ._checkDependencies(null, true) :
            this.__base(updateVal);
        return this;

    },

    _init : function() {

        var _this = this;

        _this
            ._setForm(_this)
            .__base()
            ._checkDependencies()
            .addCSSClass(_this.__self.CSS_CLASS_INITED)
            .__self._addInstance(_this);

        _this._unreadyCounter || _this.trigger('ready-change', _this); // инициирующее событие
        _this._elem.trigger('init.jz', _this);

        return _this;

    },

    _reinit : function(updateVal) {

        this._submitted = false;
        updateVal && (this._changedCounter = 0);

        return this.__base(updateVal);

    },

    _bindChildEvents : function() {},

    _bindEvents : function() {

        return this
            ._bindToElem({
                'submit'  : this._onSubmit,
                'keydown' : function(e) {
                    e.keyCode == 27 && e.preventDefault(); // IE пытается возвращать форму в исходное значение
                }});

    },

    _onSubmit : function() {

        var _this = this;

        if(_this._submitted) {
            return false;
        }

        if(_this.isReady()) {
            _this._beforeSubmit();
            var preventSubmit = _this._params.preventSubmit;
            _this.trigger('before-submit', _this);
            _this._submitted = true;
            return !preventSubmit;
        }

        if(_this._unreadyCounter) {
            $.each(_this._unreadyWidgetIds, function(id) {
                _this._widgetsDataById[id].widget._setNoReady(true);
            });
            _this._params.focusOnNoReady && _this._processFirstUnreadyWidget().focus();
        }

        return false;

    },

    _processFirstUnreadyWidget : function() {

        return this._processFirstUnreadyChildWidget();

    },

    _checkDependencies : function() {

        var _this = this;
        $.each(_this._widgetsDataById, function() {
            _this !== this.widget && this.widget._checkDependencies();
        });
        return _this;

    },

    _getDefaultParams : function() {

        return {
            heedChanges    : false,
            preventSubmit  : false,
            focusOnNoReady : true
        };

    },

    _addWidget : function(widget) {

        var _this = this;

        _this._widgetsDataById[widget.getId()] = {
            widget  : widget,
            isReady : true
        };

        !!widget.getName() && (_this._widgetsByName[widget.getName()] = widget);

        widget !== _this._bindTo(widget, 'focus', function() {
            _this.__self._currentInstance = _this;
        }) && _this
            ._bindTo(widget, {
                'ready-change' : _this._onWidgetReadyChange,
                'remove'       : _this._onWidgetRemove
            });

        widget._hasVal() &&
            widget.bind('initial-value-change', _this._onWidgetInitialValueChange, _this);

    },

    _onWidgetReadyChange : function(e, widget) {

        var _this = this,
            widgetId = widget.getId(),
            widgetData = _this._widgetsDataById[widgetId], isReady = widget.isReady();

        if(widgetData.isReady != isReady) {
            _this._unreadyCounter += (widgetData.isReady = isReady)? -1 : 1;
            isReady?
                delete _this._unreadyWidgetIds[widgetId] :
                _this._unreadyWidgetIds[widgetId] = true;
            _this.trigger('ready-change', _this);
        }

    },

    _onWidgetInitialValueChange : function(e, isInitialValueChanged) {

        var counter = this._changedCounter;
        this._changedCounter = counter + (isInitialValueChanged? 1 : -1);
        counter + this._changedCounter == 1 && this.trigger('ready-change', this);

    },

    _onWidgetRemove : function(e, widget) {

        var _this = this,
            widgetId = widget.getId(),
            widgetData = _this._widgetsDataById[widgetId];

        if(widgetData) {
            delete _this._widgetsDataById[widgetId];
            !!widget.getName() && delete _this._widgetsByName[widget.getName()];
            if(!widgetData.isReady) {
                _this._unreadyCounter--;
                delete _this._unreadyWidgetIds[widgetId];
            }
            widget._hasVal() && _this._changedCounter++;
            _this.trigger('ready-change', _this);
        }

    },

    _destruct : function() {

        this
            .removeCSSClass(this.__self.CSS_CLASS_INITED)
            .__base();
        this.__self._removeInstance(this);

        this._del('_widgetsByName', '_widgetsDataById', '_unreadyWidgetIds');

    }

}, {

    _currentInstance : null,
    _instanceCounter : 0,

    _addInstance : function(instance) {

        this._currentInstance = instance;
        ++this._instanceCounter == 1 && $(document).bind('keyup.jz', $.proxy(function(e) {
            this._currentInstance && e.keyCode == 13 && e.ctrlKey && this._currentInstance.submit();
        }, null, this));

    },

    _removeInstance : function(instance) {

        this._currentInstance == instance && (this._currentInstance = null);
        --this._instanceCounter == 0 && $(document).unbind('keyup.jz');

    }

});JZ.Storage = $.inherit({

    __constructor : function(params) {

        this._params = params;

    },

    isEmpty : function() {

        return false;

    },

    filter : function(value, callback) {}

});JZ.Storage.Local = $.inherit(JZ.Storage, {

    __constructor : function(params) {

        this.__base(params);
        this._searchList = $.map(params.list, function(val) {
            return val.toLowerCase();
        });

    },

    isEmpty : function() {

        return !this._searchList.length;

    },

    filter : function(val, callback) {

        var searchVal = val.toLowerCase(), searchList = this._searchList;
        callback(val, searchVal == ''? this._params.list : $.grep(this._params.list, function(val, i) {
            return searchList[i].indexOf(searchVal) > -1;
        }));

    }

});JZ.Storage.Remote = $.inherit(JZ.Storage, {

    filter : function(value, callback) {

        var params = this._params;
        $.ajax($.extend({
            success  : function(data) {
                callback(value, data);
            },
            error    : function() {
                callback(value, []);
            },
            dataType : 'json',
            data     : (function() {
                var result = {};
                result[params.name] = value;
                $.each(params.widgets, function() {
                    result[this.getName()] = this.val();
                });
                return result;
            })()
        }, params.ajax));

    }

});JZ.Value = $.inherit({

    __constructor : function(val) {

        this._val = null;
        this.reset();

        typeof val != 'undefined' && this.set(val);

    },

    reset : function() {

        this.set('');

    },

    get : function() {

        return this._val;

    },

    set : function(val) {

        this._val = val.toString();

    },

    match : function(pattern) {

        return pattern.test(this.get());

    },

    clone : function() {

        return new this.__self(this.get());

    },

    isEqual : function(val) {

        return this._checkForCompareTypes(val) &&
               this.toString() === new this.__self((val instanceof JZ.Value)? val.get() : val).toString();

    },

    isGreater : function(val) {

        return this._checkForCompareTypes(val) &&
               this.get().length > new this.__self((val instanceof JZ.Value)? val.get() : val).get().length;

    },

    isGreaterOrEqual : function(val) {

        return this.isGreater(val) || this.isEqual(val);

    },

    isLess : function(val) {

        return this._checkForCompareTypes(val) && !this.isGreaterOrEqual(val);

    },

    isLessOrEqual : function(val) {

        return this._checkForCompareTypes(val) && !this.isGreater(val);

    },

    isEmpty : function() {

        return this.get() === '';

    },

    toString : function() {

        return this.get().toString();

    },

    _checkForCompareTypes : function(val) {

        return val instanceof this.__self || typeof val == 'string';

    }

});
JZ.Value.Number = $.inherit(JZ.Value, {

    set : function(val) {

        this._val = parseFloat(val.toString().replace(this.__self.replaceRE, '').replace(',', '.'));

    },

    match : function(pattern) {

        return pattern.test(isNaN(this._val)? '' : this._val.toString());

    },

    isEmpty : function() {

        return isNaN(this._val);

    },

    isGreater : function(val) {

        return this._checkForCompareTypes(val) &&
               this.get() > new this.__self((val instanceof JZ.Value)? val.get() : val).get();

    },

    toString : function() {

        return isNaN(this._val)? '' : this._val.toString().replace('.', JZ.Resources.getNumberSeparator());

    },

    _checkForCompareTypes : function(val) {

        if(val instanceof this.__self || typeof val == 'number') {
            return true;
        }

        if(val instanceof JZ.Value) {
            return !isNaN(parseFloat(val.get()));
        }

        if(typeof val == 'string') {
            return !isNaN(parseFloat(val));
        }

        return false;

    }

}, {

    replaceRE : /[^0-9\.\,\-]/g

});JZ.Value.Multiple = $.inherit(JZ.Value, {

    reset : function() {

        this.set([]);

    },

    set : function(val) {

        this._val = $.makeArray(val);

    },

    match : function(pattern) {

        if(this.isEmpty()) {
            return pattern.test('');
        }

        var i = 0, length = this._val.length;
        while(i < length) {
            if(pattern.test(this._val[i++])) {
                return true;
            }
        }

        return false;

    },

    clone : function() {

        return new this.__self(this.get().slice(0));

    },

    isEmpty : function() {

        return this._val.length == 0;

    },

    isContain : function(val) {

        var i = 0, thisVal = this._val, length = thisVal.length;
        while(i < length) {
            if(thisVal[i++] == val) {
                return true;
            }
        }
        return false;

    },

    isEqual : function(val) {

        if(!this._checkForCompareTypes(val)) {
            return false;
        }

        var compareVal = val instanceof this.__self? val.get() : val,
            thisVal = this._val,
            thisValLength = thisVal.length;

        if(thisValLength != compareVal.length) {
            return false;
        }

        var i = 0;
        while(i < thisValLength) {
            if(thisVal[i] != compareVal[i++]) {
                return false;
            }
        }

        return true;

    },

    isGreater : function(val) {

        return this._checkForCompareTypes(val) &&
               this._val.length > (val instanceof this.__self? val.get() : val).length;

    },

    _checkForCompareTypes : function(val) {

        return val instanceof this.__self || $.isArray(val);

    }

});JZ.Value.Date = $.inherit(JZ.Value, {

    reset : function() {

        this._val = { day : '', month : '', year : '' };

    },

    get : function() {

        return this.isEmpty()? '' : this.getYear() + '-' + this.getMonth() + '-' + this.getDay();

    },

    set : function(val) {

        var date;

        if(val instanceof Date) {
            date = val;
        }
        else {
            var matches = val.match(this.__self.matchRE);
            matches && (date = this._createDateFromArray(matches));
        }

        date?
            this._val = this._createValFromDate(date) :
            this.reset();

    },

    isEmpty : function() {

        return !(this._val.year && this._val.month && this._val.day);

    },

    isEqual : function(val) {

        var _self = this.__self;

        if(val instanceof _self.Time) {
            return this.get() + ' 0:0:0' == val.get();
        }

        if(val instanceof _self) {
            return this.get() == val.get();
        }

        if(val instanceof JZ.Value) {
            return this.get() == val.get();
        }

        if(val instanceof Date) {
            return this.get() == new _self(val).get();
        }

        return this.get() === val;

    },

    isGreater : function(val) {

        (val instanceof JZ.Value.Date) ||
            (val = new JZ.Value.Date(val instanceof JZ.Value? val.get() : val));

        if(this.isEmpty() || val.isEmpty()) {
            return false;
        }

        if(this.getYear() > val.getYear()) {
            return true;
        }

        if(this.getYear() == val.getYear()) {
            return this.getMonth() > val.getMonth()?
                true :
                this.getMonth() == val.getMonth() && this.getDay() > val.getDay();
        }

        return false;

    },

    getYear : function() {

        return this._val.year;

    },

    getMonth : function() {

        return this._val.month;

    },

    getDay : function() {

        return this._val.day;

    },

    toString : function() {

        return this.isEmpty()? '' :
            this.getYear() + '-' + this._padNumber(this.getMonth()) + '-' + this._padNumber(this.getDay());

    },

    _padNumber : function(val) {

        return (val < 10? '0' : '') + val;

    },

    _checkForCompareTypes : function(val) {

        var dateType = JZ.Value.Date;
        if(val instanceof dateType || val instanceof dateType.Time) {
            return !val.isEmpty();
        }

        if(val instanceof JZ.Value) {
            return !(new dateType(val.get()).isEmpty());
        }

        if(typeof val == 'string') {
            return !(new dateType(val).isEmpty());
        }

        return val instanceof Date;

    },

    _createDateFromArray : function(arr) {

        return new Date(
            parseInt(arr[1], 10),
            parseInt(arr[2], 10) - 1,
            parseInt(arr[3], 10));

    },

    _createValFromDate : function(date) {

        return {
            day   : date.getDate(),
            month : date.getMonth() + 1,
            year  : date.getFullYear()
        };

    }

}, {

    matchRE : /^(\d{1,4})-(\d{1,2})-(\d{1,2})/

});JZ.Value.Date.Time = $.inherit(JZ.Value.Date, {

    reset : function() {

        this._val = { second : '', minute : '', hour : '', day : '', month : '', year : '' };

    },

    get : function() {

        return this.isEmpty()?
            '' :
            this.__base() + ' ' + this.getHour() + ':' + this.getMinute() + ':' + this.getSecond();

    },

    isEmpty : function() {

        return this.__base() || this._val.hour === '' || this._val.minute === '' || this._val.second === '';

    },

    isEqual : function(val) {

        if(val instanceof this.__self) {
            return this.get() == val.get();
        }

        if(val instanceof JZ.Value.Date) {
            return this.get() == val.get() + ' 0:0:0';
        }

        if(val instanceof JZ.Value) {
            return this.get() == val.get();
        }

        if(val instanceof Date) {
            return this.get() == new this.__self(val).get();
        }

        return this.get() === val;

    },

    isGreater : function(val) {

        if(this.__base(val)) {
            return true;
        }

        val = val instanceof this.__self?
            val :
            new this.__self(
                (val instanceof JZ.Value.Date?
                    val.get() + ' 0:0:0' :
                    (val instanceof JZ.Value? val.get() : val)));

        if(this.getDay() == val.getDay()) {
            if(this.getHour() > val.getHour()) {
                return true;
            }
            else if(this.getHour() == val.getHour()) {
                return this.getMinute() > val.getMinute()?
                    true :
                    this.getMinute() == val.getMinute() && this.getSecond() > val.getSecond();
            }

        }

        return false;

    },

    getHour : function() {

        return this._val.hour;

    },

    getMinute : function() {

        return this._val.minute;

    },

    getSecond : function() {

        return this._val.second;

    },

    toString : function() {

        return this.isEmpty()?
            '' :
            (this.__base() +
               ' ' + this._padNumber(this.getHour()) +
               ':' + this._padNumber(this.getMinute()) +
               ':' + this._padNumber(this.getSecond()));

    },

    _createDateFromArray : function(arr) {

        var result = this.__base(arr);
        result.setHours(parseInt(arr[4], 10));
        result.setMinutes(parseInt(arr[5], 10));
        result.setSeconds(parseInt(arr[6], 10));
        return result;

    },

    _createValFromDate : function(date) {

        return $.extend(this.__base(date), {
            second : date.getSeconds(),
            minute : date.getMinutes(),
            hour   : date.getHours()
        });

    }

}, {

    matchRE : /^(\d{1,4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})/

});JZ.Dependence = $.inherit({

    __constructor : function(params) {

        this._params = $.extend(this._getDefaultParams(), this._preprocessParams(params));

    },

    getFrom : function() {

        return [this._params.widget];

    },

    removeFrom : function(widget) {

        return this._params.widget === widget? null : this;

    },

    check : function() {

        var result = this._precheck() && this._processResult();
        return {
            result : result,
            params : this._processParams(result)
        };

    },

    _preprocessParams : function(params) {

        typeof params.pattern == 'string' && (params.pattern = new RegExp(params.pattern));

        return params;

    },

    _precheck : function() {

        return this._params.widget.isEnabled();

    },

    _processResult : function() {

        var params = this._params;
        return params.fn?
            params.fn(params.widget) :
            params.widget._getVal().match(params.pattern);

    },

    _processParams : function(result) {},

    _getDefaultParams : function() {

        return {
            pattern : /.+/
        };

    }

}, {

    _onOR  : function() {},
    _onAND : function() {}

});JZ.Dependence.Composition = $.inherit(JZ.Dependence, {

    getFrom : function() {

        var result = [];
        $.each(this._params.dependencies, function() {
            result = result.concat(this.getFrom());
        });
        return result;

    },

    removeFrom : function(widget) {

        var dependencies = [];
        $.each(this._params.dependencies, function() {
            var dependence = this.removeFrom(widget);
            dependence && dependencies.push(dependence);
        });
        var len = dependencies.length;
        return len?
            len == 1 && this._params.dependencies.length > 1?
                dependencies[0] :
                this :
            null;

    }


});JZ.Dependence.Composition.NOT = $.inherit(JZ.Dependence.Composition, {

    _precheck : function() {

        return this._params.dependencies[0]._precheck();

    },

    _processResult : function() {

        return !this._params.dependencies[0]._processResult();

    },

    _processParams : function(result) {

        return this._params.dependencies[0]._processParams(result);

    }

});JZ.Dependence.Composition.OR = $.inherit(JZ.Dependence.Composition, {

    __constructor : function(params) {

        this.__base(params);

        this._resultLeft = this._resultRight = false;

    },

    _precheck : function() {

        var dependencies = this._params.dependencies;
        this._resultLeft = dependencies[0]._precheck();
        this._resultRight = dependencies[1]._precheck();

        return this._resultLeft || this._resultRight;

    },

    _processResult : function() {

        var dependencies = this._params.dependencies;
        this._resultLeft = this._resultLeft && dependencies[0]._processResult();
        this._resultRight = this._resultRight && dependencies[1]._processResult();

        return this._resultLeft || this._resultRight;

    },

    _processParams : function(result) {

        var dependencies = this._params.dependencies;
        return dependencies[0].__self._onOR({
            result : this._resultLeft,
            params : dependencies[0]._processParams(this._resultLeft)
        }, {
            result : this._resultRight,
            params : dependencies[1]._processParams(this._resultRight)
        });

    }

});JZ.Dependence.Composition.AND = $.inherit(JZ.Dependence.Composition, {

    __constructor : function(params) {

        this.__base(params);

        this._resultLeft = this._resultRight = false;

    },

    _precheck : function() {

        var dependencies = this._params.dependencies;
        this._resultLeft = dependencies[0]._precheck();
        this._resultRight = dependencies[1]._precheck();

        return this._resultLeft && this._resultRight;

    },

    _processResult : function() {

        var dependencies = this._params.dependencies;
        this._resultLeft = this._resultLeft && dependencies[0]._processResult();
        this._resultRight = this._resultRight && dependencies[1]._processResult();

        return this._resultLeft && this._resultRight;

    },

    _processParams : function(result) {

        var dependencies = this._params.dependencies;
        return dependencies[0].__self._onAND({
                result : this._resultLeft,
                params : dependencies[0]._processParams(this._resultLeft)
            }, {
                result : this._resultRight,
                params : dependencies[1]._processParams(this._resultRight)
            });

    }

});JZ.Dependence.Required = $.inherit(JZ.Dependence, {

    __constructor : function(params) {

        this.__base(params);

        var min = this._params.min;
        this._params.pattern = min > 1?
            new RegExp('\\S.{' + (min - 2) + ',}\\S') :
            /\S+/;
        this._params.patternChild = /\S+/;

    },

    _processResult : function() {

        return this._params.widget._checkRequired(this._params);

    },

    _getDefaultParams : function() {

        return {
            min : 1
        };

    }

});JZ.Dependence.Valid = $.inherit(JZ.Dependence, {

    _preprocessParams : function(params) {

        params.type == 'email' && (params.pattern = /^[a-zA-Z0-9][a-zA-Z0-9\.\-\_\~]*\@[a-zA-Z0-9\.\-\_]+\.[a-zA-Z]{2,4}$/);
        return params;

    },

    _processResult : function() {

        return this._params.checkEmpty? this.__base() : (this._params.widget._getVal().isEmpty() || this.__base());

    },

    _processParams : function(result) {

        var invalidCSSClass = this._params.invalidCSSClass;
        return {
            invalidCSSClasses : invalidCSSClass? [{ name : invalidCSSClass, add : !result }] : []
        };

    },

    _getDefaultParams : function() {

        return $.extend(this.__base(), {
            checkEmpty : false
        });

    }

}, {

    _onOR : function(checkLeft, checkRight) {

        return {
            invalidCSSClasses : checkLeft.params.invalidCSSClasses.concat(checkRight.params.invalidCSSClasses)
        };

    },

    _onAND : function(checkLeft, checkRight) {

        return this._onOR(checkLeft, checkRight);

    }

});JZ.Dependence.Enabled = $.inherit(JZ.Dependence, {

    _processParams : function(result) {

        return {
            focusOnEnable : result && this._params.focusOnEnable,
            hideOnDisable : !result && this._params.hideOnDisable
        };

    },

    _getDefaultParams : function() {

        return {
            focusOnEnable : false,
            hideOnDisable : false
        };

    }

}, {

    _onOR : function(checkLeft, checkRight) {

        return {
            focusOnEnable : checkLeft.params.focusOnEnable || checkRight.params.focusOnEnable,
            hideOnDisable : checkLeft.params.hideOnDisable || checkRight.params.hideOnDisable
        };

    },

    _onAND : function(checkLeft, checkRight) {

        return {
            focusOnEnable : checkLeft.params.focusOnEnable && checkRight.params.focusOnEnable,
            hideOnDisable : checkLeft.params.hideOnDisable && checkRight.params.hideOnDisable
        };

    }

});JZ.Builder = $.inherit({

    __constructor : function() {

        this._widgets = [];
        this._widgetsByName = {};
        this._widgetsById = {};

    },

    build : function(elem) {

        var _this = this, fromIndex = this._widgets.length, widget, initWidget;
        $.each(elem.add(elem.find('.' + JZ.CSS_CLASS_WIDGET)), function(i) {
            widget = _this._makeWidgetByElem($(this));
            _this._widgets.push(_this._widgetsById[widget.getId()] = widget);
            i == 0 && (initWidget = widget);
        });

        // Строим хэш по именам после создании дерева виджетов, потому что имена некоторых виджетов зависят от детей
        var widgets = _this._widgets, i = fromIndex;
        while(widget = widgets[i++]) {
            widget._hasVal() && (_this._widgetsByName[widget.getName()] = widget);
        }

        // Перебираем, строим зависимости, потому что только здесь знаем имена виджетов
        while(widget = widgets[fromIndex++]) {
            this._buildDependencies(widget);
        }

        if(elem[0].tagName.toLowerCase() == 'form') {
            elem.data('jz-builder', this);
            initWidget
                .bind('remove', $.proxy(this._onFormRemove, this))
                .init();
        }
        else {
            widgets[0].init(false, initWidget);
        }

        return initWidget;

    },

    _makeWidgetByElem : function(elem) {

        var _self = this.__self,
            params = _self._extractParamsFromElem(elem),
            result = new (_self._getWidgetClassByType(params.type))(elem, _self._getClassElem(elem, params), params);

        params.type != 'form' && this._getParentWidget(elem).addChild(result);

        return result;

    },

    _getParentWidget : function(elem) {

        var node = elem[0].parentNode,
            className = ' ' + JZ.CSS_CLASS_WIDGET + ' ';
        do {
            if((' ' + node.className + ' ').indexOf(className) > -1) {
                return this._widgetsById[JZ._identifyNode(node)];
            }
        } while(node = node.parentNode);

    },

    _buildDependencies : function(widget) {

        var params = widget._params, _this = this;
        $.each(['enabled', 'valid', 'required'], function() {
            this in params && widget.addDependence(this, _this._buildDependence(this, widget, params[this]));
        });

    },

    _buildDependence : function(type, widget, data) {

        return $.isArray(data)?
            (typeof data[0] == 'string'?
                new JZ.Dependence.Composition.NOT({ dependencies : [this._buildDependence(type, widget, data[1])] }) :
                new JZ.Dependence.Composition[data[1].toUpperCase()]({ dependencies :
                    [this._buildDependence(type, widget, data[0]), this._buildDependence(type, widget, data[2])] })) :
            new JZ.Dependence[type.charAt(0).toUpperCase() + type.substr(1).toLowerCase()](
                $.extend(data, { widget : this._getFromWidget(data, widget) }));

    },

    _getFromWidget : function(params, widget) {

        return params.id?
             this._widgetsById[params.id] :
             (params.name?
                 this._widgetsByName[params.name] :
                 widget) ||
            JZ._throwException('widget with name/id = "' + (params.id || params.name) + '" not found"');

    },

    _onFormRemove : function(e, form) {

        form.getElement().removeData('jz-builder');

        delete this._widgets;
        delete this._widgetsByName;
        delete this._widgetsById;

    }

},
{

    registerWidget : function(type, parentType, props, staticProps) {

        if(typeof parentType != 'string') {
            staticProps = props;
            props = parentType;
            parentType = undefined;
        }

        this._types.push(type);
        this._typeToWidgetClass[type] = $.inherit(
            parentType? this._getWidgetClassByType(parentType) : JZ.Widget,
            props,
            staticProps);

    },

    _getClassElem : function(elem, params) {

        if(params.container) {
            return elem.closest(params.container);
        }

        switch(params.type) {
            case 'form':
            case 'fieldset':
            case 'button':
            case 'submit':
                return elem;

            case 'rbgroup':
            case 'cbgroup':
            case 'state':
                return elem.parent();

            default:
                return elem.attr('type') == 'hidden'? elem : elem.closest('.' + JZ.CSS_CLASS_WIDGET + '-widget');
        }

    },

    _extractParamsFromElem : function(elem) {

        var result = elem[0].onclick? elem[0].onclick().jz || {} : {};

        result.type || (result.type = this._extractTypeFromElem(elem));

        if(result.type == 'combo') {
            var arrow = elem.parent().find('.' + JZ.CSS_CLASS_WIDGET + '-comboarrow');
            arrow.length && (result.arrow = arrow);
        }

        return result;

    },

    _extractTypeFromElem : function(elem) {

        var tagName = elem[0].tagName.toLowerCase();

        if(tagName == 'input') {
            switch(elem.attr('type')) {
                case 'radio':
                case 'checkbox':
                    return 'state';

                case 'button':
                    return 'button';

                case 'image':
                case 'submit':
                    return 'submit';
            }
        }

        return tagName == 'select' || tagName == 'fieldset' || tagName == 'form'?
            tagName :
            (this._cssClassToType(elem.attr('class')) || 'text');

    },

    _types : ['number', 'combo', 'datetime', 'date', 'fieldset', 'rbgroup', 'cbgroup', 'submit'],
    _typeRE : null,

    _rebuildTypeRE : function() {

        return this._typeRE = new RegExp(JZ.CSS_CLASS_WIDGET + '-(' + this._types.join('|') +')(?:\\s|$)');

    },

    _cssClassToType : function(cssClass) {

        return (cssClass.match(this._typeRE || this._rebuildTypeRE()) || [])[1];

    },

    _typeToWidgetClass : {
        'text'       : JZ.Widget.Input.Text,
        'number'   : JZ.Widget.Input.Text.Number,
        'combo'    : JZ.Widget.Input.Text.Combo,
        'select'   : JZ.Widget.Input.Select,
        'date'     : JZ.Widget.Container.Date,
        'datetime' : JZ.Widget.Container.Date.Time,
        'state'    : JZ.Widget.Input.State,
        'button'   : JZ.Widget.Button,
        'submit'   : JZ.Widget.Button.Submit,
        'fieldset' : JZ.Widget.Container,
        'rbgroup'  : JZ.Widget.Container.StateGroup.RadioButtons,
        'cbgroup'  : JZ.Widget.Container.StateGroup.CheckBoxes,
        'form'       : JZ.Widget.Container.Form
    },

    _getWidgetClassByType : function(type) {

        return this._typeToWidgetClass[type] || JZ._throwException('undefined type "' + type + '"');

    }

});
JZ.Resources = {

    lang : $(document.documentElement).attr('lang') || 'ru',

    months : {
        ru : {
            'normal'   : ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
            'genitive' : ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
        },
        en : {
            'normal'   : ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
            'genitive' : ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
        }
    },

    daysOfWeek : {
        ru : ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
        en : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },

    numberSeparators : {
        ru : ',',
        en : '.'
    },

    getDaysOfWeek : function() {

        return this.daysOfWeek[this.lang];

    },

    getMonthsByType : function(type) {

        return this.months[this.lang][type];

    },

    getNumberSeparator : function() {

        return this.numberSeparators[this.lang];

    }

};