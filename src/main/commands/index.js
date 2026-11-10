'use strict';

// Her command registry: every command lives in the module it belongs to (commands/*.js), each a function that takes
// { said, cased, text } and gives back what you asked for, or nothing. ORDER is which one gets the first word: to add a
// command, write it in its module and put its name here, before anything that would otherwise take its words.

const MODULES = {
  modes: require('./modes'), self: require('./self'), eyes: require('./eyes'), body: require('./body'),
  hands: require('./hands'), music: require('./music'), web: require('./web'), day: require('./day'), home: require('./home'),
};

const ORDER = [
  'self.teach', 'modes.hold', 'home.lights', 'day.weather', 'day.brief',
  'eyes.homework', 'hands.codeHere', 'hands.draft', 'hands.type', 'hands.click', 'hands.key', 'web.browse', 'eyes.look', 'body.form', 'body.move',
  'music.playlist', 'music.lyrics', 'music.songControl', 'music.lyricsNow', 'music.listen', 'music.songOpinion', 'music.nowPlaying',
  'hands.code', 'day.clock', 'day.math',
  'music.spotifySearch', 'web.browserOpen', 'web.browserSearch', 'web.find',
  'self.rate', 'self.sync', 'self.dare', 'self.dareDone', 'self.forgetAll', 'self.forget', 'self.remember',
  'day.clearAlarms', 'day.stopStudy', 'day.study', 'day.timer',
  'music.pick', 'music.songOnSpotify', 'music.favorite', 'music.playSong', 'web.search', 'web.open', 'music.mediaKeys',
];

const COMMANDS = ORDER.map((id) => {
  const [module, name] = id.split('.');
  const run = MODULES[module]?.commands?.[name];
  if (typeof run !== 'function') throw new Error(`no command ${id}`);
  return { id, run };
});

// Every command in a module has to be in ORDER: one left out would simply never run.
for (const [module, { commands }] of Object.entries(MODULES)) {
  for (const name of Object.keys(commands)) {
    if (!ORDER.includes(`${module}.${name}`)) throw new Error(`${module}.${name} isn't in ORDER`);
  }
}

module.exports = { COMMANDS, ORDER };
