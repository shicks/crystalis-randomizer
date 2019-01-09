#!/bin/sh

shopt -s nullglob

# Publish to github-pages

# Start by checking out the repo in a subdirectory

HASH=$(git rev-parse HEAD | head -c 7)
DATE=$(date)
TMP=$(mktemp -d)
(
  cd $TMP
  git clone --depth=1 git@github.com:shicks/crystalis-randomizer r -b gh-pages
  cd r
  rm -rf *
  mkdir -p view
)
(
  cp notes/depgraph.svg $TMP/r/
  cp notes/locations.svg $TMP/r/
  cp notes/traversal.txt $TMP/r/
  cd src
  cp *.js *.css $TMP/r
  cp view/*.js view/*.css $TMP/r/view/
  # TODO - add a datestamp or commit stamp into the HTML somehow
  #      - maybe use sed to replace a placeholder?
  for a in *.html view/*.html; do
    cat ga.tag $a >| $TMP/r/$a
  done
  sed -e "/BUILD_HASH/ s/latest/$HASH/" -e "/BUILD_DATE/ s/current/$DATE/" \
      patch.js >| $TMP/r/patch.js
)
(
  cd $TMP/r
  git add .
  git commit -am "Publish: $(date)"
  git push origin gh-pages
  cd ../..
  rm -rf $TMP
)