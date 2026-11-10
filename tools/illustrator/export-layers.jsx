// Exports an Illustrator file following its layers: every named group directly in a layer is a model with a folder of its own, and each
// thing inside it (a hand, a mouth frame, a spark shape) is its own SVG, numbered in the Layers panel's order, on the model's canvas so
// the pieces still line up. Pieces you've hidden are exported too: a frame that's hidden now is still a frame. manifest.json lists it
// all. Everything is copied to a scratch document first, so your file isn't touched and is never saved.
//
// In Illustrator: File > Scripts > Other Script..., with the file open. Or: node scripts/export-ai.js drawing.ai
// (ExtendScript is old JavaScript: no let, const or arrow functions in here.)

(function () {
  var given = typeof CAPRI_FILE === 'string' ? CAPRI_FILE : '';
  var outGiven = typeof CAPRI_OUT === 'string' ? CAPRI_OUT : '';
  var reportTo = typeof CAPRI_REPORT === 'string' ? CAPRI_REPORT : '';
  var quitAfter = typeof CAPRI_QUIT === 'boolean' ? CAPRI_QUIT : false;

  var interaction = app.userInteractionLevel;
  if (reportTo) app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; // nobody at the keyboard to answer a dialog

  var opened = false;
  var doc;
  if (given) {
    var wanted = new File(given);
    for (var d = 0; d < app.documents.length; d++) if (app.documents[d].fullName.fsName === wanted.fsName) doc = app.documents[d];
    if (!doc) {
      doc = app.open(wanted);
      opened = true;
    }
  } else if (app.documents.length) {
    doc = app.activeDocument;
  } else {
    alert('Open your drawing first.');
    return;
  }
  var out = new Folder(outGiven || (doc.path.fsName + '/' + doc.name.replace(/\.[^.]+$/, '') + '-export'));
  if (!out.exists) out.create();

  function json(v) {
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\t]/g, ' ') + '"';
    var parts = [];
    var i;
    if (v instanceof Array) {
      for (i = 0; i < v.length; i++) parts.push(json(v[i]));
      return '[' + parts.join(',') + ']';
    }
    for (i in v) if (v.hasOwnProperty(i)) parts.push(json(i) + ':' + json(v[i]));
    return '{' + parts.join(',') + '}';
  }

  function svgOptions() {
    var o = new ExportOptionsSVG();
    o.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES; // her window can't load a drawing's own CSS
    o.embedRasterImages = true;
    o.coordinatePrecision = 2;
    o.documentEncoding = SVGDocumentEncoding.UTF8;
    o.fontType = SVGFontType.OUTLINEFONT;
    o.preserveEditability = false;
    return o;
  }

  var safe = function (name) { return String(name).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed'; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  function unionOf(items) {
    var b = items[0].visibleBounds;
    var r = [b[0], b[1], b[2], b[3]];
    for (var i = 1; i < items.length; i++) {
      b = items[i].visibleBounds;
      if (b[0] < r[0]) r[0] = b[0];
      if (b[1] > r[1]) r[1] = b[1];
      if (b[2] > r[2]) r[2] = b[2];
      if (b[3] < r[3]) r[3] = b[3];
    }
    return r;
  }

  var manifest = { source: doc.name, models: [], errors: [] };

  // items: the pieces, first one on top in the Layers panel
  function exportModel(name, items) {
    var folder = new Folder(out.fsName + '/' + safe(name));
    if (!folder.exists) folder.create();
    var u = unionOf(items);
    var width = u[2] - u[0];
    var height = u[1] - u[3];
    var model = { name: name, folder: safe(name), width: width, height: height, parts: [] };
    var scratch = app.documents.add(DocumentColorSpace.RGB, Math.max(1, width), Math.max(1, height));
    try {
      var target = scratch.layers[0];
      var ab = scratch.artboards[0].artboardRect;
      // an invisible box the size of the canvas: every piece comes out on the same canvas, so they line up
      var pin = target.pathItems.rectangle(ab[1], ab[0], width, height);
      pin.filled = false;
      pin.stroked = false;
      pin.name = 'capri-canvas';
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var partName = item.name || '';
        var file = pad(i + 1) + (partName ? '-' + safe(partName) : '') + '.svg';
        try {
          var copy = item.duplicate(target, ElementPlacement.PLACEATBEGINNING);
          copy.hidden = false;
          // where it sits on the model, measured: a copy in another document doesn't keep its numbers
          var from = item.visibleBounds;
          var now = copy.visibleBounds;
          copy.translate(ab[0] + (from[0] - u[0]) - now[0], ab[1] - (u[1] - from[1]) - now[1]);
          scratch.exportFile(new File(folder.fsName + '/' + file), ExportType.SVG, svgOptions());
          copy.remove();
          model.parts.push({ index: i, file: file, name: partName, type: item.typename, hidden: Boolean(item.hidden) });
        } catch (err) {
          manifest.errors.push(name + '/' + file + ': ' + err.message);
        }
      }
    } catch (err3) {
      manifest.errors.push(name + ': ' + err3.message);
    }
    scratch.close(SaveOptions.DONOTSAVECHANGES);
    manifest.models.push(model);
  }

  function list(collection) {
    var all = [];
    for (var i = 0; i < collection.length; i++) all.push(collection[i]);
    return all;
  }

  try {
    for (var l = 0; l < doc.layers.length; l++) {
      var layer = doc.layers[l];
      var items = list(layer.pageItems);
      if (!items.length) continue;
      var named = 0;
      for (var n = 0; n < items.length; n++) {
        if (items[n].typename === 'GroupItem' && items[n].name) {
          exportModel(items[n].name, list(items[n].pageItems));
          named++;
        }
      }
      // a layer with no named groups in it is one model
      if (!named) exportModel(layer.name, items);
    }
  } catch (err2) {
    manifest.errors.push(String(err2.message));
  }

  function write(file, text) {
    file.encoding = 'UTF-8';
    file.open('w');
    file.write(text);
    file.close();
  }
  write(new File(out.fsName + '/manifest.json'), json(manifest));
  if (opened) doc.close(SaveOptions.DONOTSAVECHANGES);
  app.userInteractionLevel = interaction;
  var pieces = 0;
  for (var m = 0; m < manifest.models.length; m++) pieces += manifest.models[m].parts.length;
  if (reportTo) write(new File(reportTo), json({ folder: out.fsName, pieces: pieces, models: manifest.models.length, errors: manifest.errors }));
  else alert(pieces + ' pieces exported to ' + out.fsName + (manifest.errors.length ? '\n' + manifest.errors.join('\n') : ''));
  if (quitAfter && app.documents.length === 0) app.quit(); // Illustrator was started for this: it goes away again
}());
