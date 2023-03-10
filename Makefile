ifneq (grouped-target, $(findstring grouped-target,$(.FEATURES)))
ERROR:=$(error This version of make does not support required 'grouped-target' (4.3+).)
endif

.DELETE_ON_ERROR:
.PHONY: all build lint lint-fix qa test

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

TEST_STAGING:=test-staging

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

last-test.txt: $(LIQ_PROJECTS_TEST_BUILT_FILES) $(LIQ_PROJECTS_TEST_BUILT_DATA)
	( set -e; set -o pipefail; \
		JS_SRC=$(TEST_STAGING) $(CATALYST_SCRIPTS) test 2>&1 | tee last-test.txt; )

test: last-test.txt

# lint rules
last-lint.txt: $(LIQ_PROJECTS_ALL_FILES)
	( set -e; set -o pipefail; \
		JS_LINT_TARGET=$(LIQ_PROJECTS_SRC) $(CATALYST_SCRIPTS) lint | tee last-lint.txt; )

lint: last-lint.txt

lint-fix:
	JS_LINT_TARGET=$(LIQ_PROJECTS_SRC) $(CATALYST_SCRIPTS) lint-fix

qa: test lint
