import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('motion library pins agree with npm lock and provenance', () => {
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  for(const [name,version] of Object.entries({'gsap':'3.13.0','lenis':'1.3.13','@gsap/react':'2.1.2'})){
    assert.equal(pkg.dependencies[name],version);
    assert.equal(lock.packages[''].dependencies[name],version);
    assert.equal(lock.packages['node_modules/'+name].version,version);
    assert.match(lock.packages['node_modules/'+name].resolved,/^https:\/\/registry\.npmjs\.org\//);
    assert.match(lock.packages['node_modules/'+name].integrity,/^sha512-/);
  }
});

test('motion is opt-in and preserves reduced-motion and nested scroll escapes',()=>{
  const source=fs.readFileSync('modules/pmo-de-motion/MotionRuntime.tsx','utf8');
  assert.match(source,/data-pmo-de-motion/);
  assert.match(source,/prefers-reduced-motion/);
  assert.match(source,/data-lenis-prevent/);
  assert.match(source,/gsap\.ticker\.remove\(tick\)/);
  assert.match(source,/lenis\.destroy\(\)/);
});

test('guest page keeps actual listings and bilingual navigation',()=>{
  const source=fs.readFileSync('app/guest-explore.tsx','utf8');
  assert.match(source,/supabase\.from\("epks"\)/);
  assert.match(source,/LanguageSwitch/);
  assert.match(source,/data-pmo-de-motion/);
  assert.match(source,/SplitText/);
  assert.match(source,/aria-pressed/);
});
