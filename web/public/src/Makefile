all:
	# sentinel
	@./node_modules/.bin/browserify -t [ babelify --presets [ es2015 ] --plugins [ transform-regenerator transform-runtime ] ] -t uglifyify ./common.js > ../common.js

	# uglify
	./node_modules/.bin/uglifyjs ../common.js -p 5 -c -m -o ../common.js
