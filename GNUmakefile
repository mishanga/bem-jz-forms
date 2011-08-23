all: i-jz-form

i-jz-form :: src
i-jz-form :: blocks/i-jz-form blocks/i-jquery

JQUERY_FILES=$(foreach I,memoize fieldselection,blocks/i-jquery/__$I/i-jquery__$I.js)

blocks/i-jquery: $(JQUERY_FILES)

$(JQUERY_FILES):
	mkdir -p $(@D)
	cp src/js/jquery/$(subst i-jquery__,jquery.,$(@F)) $@

blocks/i-jz-form: blocks/i-jz-form/__core/i-jz-form__core.js

blocks/i-jz-form/__core/i-jz-form__core.js: $(addprefix src/js/,\
	JZ.js\
	$(addprefix JZ/,\
		Observable.js \
		Widget.js \
		$(addprefix Widget/,\
			Input.js \
			Input/Text.js \
			Input/Text/Number.js \
			Input/Text/Combo.js \
			Input/Select.js \
			Input/State.js \
			Button.js \
			Button/Submit.js \
			Container.js \
			Container/StateGroup.js \
			Container/StateGroup/CheckBoxes.js \
			Container/StateGroup/RadioButtons.js \
			Container/Date.js \
			Container/Date/Time.js \
			Container/Form.js) \
		Storage.js \
		Storage/Local.js \
		Storage/Remote.js \
		Value.js \
		Value/Number.js \
		Value/Multiple.js \
		Value/Date.js \
		Value/Date/Time.js \
		Dependence.js \
		Dependence/Composition.js \
		Dependence/Composition/NOT.js \
		Dependence/Composition/OR.js \
		Dependence/Composition/AND.js \
		Dependence/Required.js \
		Dependence/Valid.js \
		Dependence/Enabled.js \
		Builder.js \
		Resources.js))
	mkdir -p $(@D)
	cat $^ > $@

DO_GIT=@echo git $1 $2; \
	if [ -d $2 ]; \
		then \
			cd $2 && git pull origin master; \
		else \
			git clone $1 $2; \
	fi

src:
	$(call DO_GIT,git://github.com/dfilatov/jz.git,$@)
