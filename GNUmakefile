all: i-jz-forms

i-jz-forms: blocks/i-jz-forms

blocks/i-jz-forms: src blocks/i-jz-forms/i-jz-forms.js

blocks/i-jz-forms/i-jz-forms.js:	src/JZ.js \
									src/JZ.js \
									src/JZ/Observable.js \
									src/JZ/Widget.js \
									src/JZ/Widget/Input.js \
									src/JZ/Widget/Input/Text.js \
									src/JZ/Widget/Input/Text/Number.js \
									src/JZ/Widget/Input/Text/Combo.js \
									src/JZ/Widget/Input/Select.js \
									src/JZ/Widget/Input/State.js \
									src/JZ/Widget/Button.js \
									src/JZ/Widget/Button/Submit.js \
									src/JZ/Widget/Container.js \
									src/JZ/Widget/Container/StateGroup.js \
									src/JZ/Widget/Container/StateGroup/CheckBoxes.js \
									src/JZ/Widget/Container/StateGroup/RadioButtons.js \
									src/JZ/Widget/Container/Date.js \
									src/JZ/Widget/Container/Date/Time.js \
									src/JZ/Widget/Container/Form.js \
									src/JZ/Storage.js \
									src/JZ/Storage/Local.js \
									src/JZ/Storage/Remote.js \
									src/JZ/Value.js \
									src/JZ/Value/Number.js \
									src/JZ/Value/Multiple.js \
									src/JZ/Value/Date.js \
									src/JZ/Value/Date/Time.js \
									src/JZ/Dependence.js \
									src/JZ/Dependence/Composition.js \
									src/JZ/Dependence/Composition/NOT.js \
									src/JZ/Dependence/Composition/OR.js \
									src/JZ/Dependence/Composition/AND.js \
									src/JZ/Dependence/Required.js \
									src/JZ/Dependence/Valid.js \
									src/JZ/Dependence/Enabled.js \
									src/JZ/Builder.js \
									src/JZ/Resources.js \
									src/init.js
	mkdir -p blocks/i-jz-forms
	cat $^ > $@

%.js:
	@echo $@

src:
	svn co http://jz-forms.googlecode.com/svn/trunk/js/ src
