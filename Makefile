.DELETE_ON_ERROR:
.PHONY: all build test lint lint-fix

default: build

CATALYST_SCRIPTS:=npx catalyst-scripts

LIQ_PROJECTS_SRC:=src
LIQ_PROJECTS_FILES:=$(shell find $(LIQ_PROJECTS_SRC) \( -name "*.js" -o -name "*.mjs" \) -not -path "*/test/*" -not -name "*.test.js")
LIQ_PROJECTS_ALL_FILES:=$(shell find $(LIQ_PROJECTS_SRC) \( -name "*.js" -o -name "*.mjs" \))
LIQ_PROJECTS_TEST_SRC_FILES:=$(shell find $(LIQ_PROJECTS_SRC) -name "*.js")
LIQ_PROJECTS_TEST_BUILT_FILES:=$(patsubst $(LIQ_PROJECTS_SRC)/%, test-staging/%, $(LIQ_PROJECTS_TEST_SRC_FILES))
LIQ_PROJECTS_TEST_SRC_DATA:=$(shell find $(LIQ_PROJECTS_SRC) -path "*/test/data/*" -type f)
LIQ_PROJECTS_TEST_BUILT_DATA:=$(patsubst $(LIQ_PROJECTS_SRC)/%, test-staging/%, $(LIQ_PROJECTS_TEST_SRC_DATA))
LIQ_PROJECTS:=dist/liq-projects.js

BUILD_TARGETS:=$(LIQ_PROJECTS)

# build rules
build: $(BUILD_TARGETS)

all: build

$(LIQ_PROJECTS): package.json $(LIQ_PROJECTS_FILES)
	JS_SRC=$(LIQ_PROJECTS_SRC) $(CATALYST_SCRIPTS) build

# test
$(LIQ_PROJECTS_TEST_BUILT_DATA): test-staging/%: $(LIQ_PROJECTS_SRC)/%
	@echo "Copying test data..."
	@mkdir -p $(dir $@)
	@cp $< $@

$(LIQ_PROJECTS_TEST_BUILT_FILES) &: $(LIQ_PROJECTS_ALL_FILES)
	JS_SRC=$(LIQ_PROJECTS_SRC) $(CATALYST_SCRIPTS) pretest

test: $(LIQ_PROJECTS_TEST_BUILT_FILES) $(LIQ_PROJECTS_TEST_BUILT_DATA)
	JS_SRC=test-staging $(CATALYST_SCRIPTS) test

# lint rules
lint:
	JS_LINT_TARGET=$(LIQ_PROJECTS_SRC) $(CATALYST_SCRIPTS) lint

lint-fix:
	JS_LINT_TARGET=$(LIQ_PROJECTS_SRC) $(CATALYST_SCRIPTS) lint-fix
