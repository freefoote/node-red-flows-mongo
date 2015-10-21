var when = require('when');
var nodeFn = require('when/node/function');
var keys = require('when/keys');
var mongoose = require('mongoose');
var path = require('path');

var settings;

var storageSchema = mongoose.Schema({
    type: { type: [String], index: true },
    path: { type: [String], index: true },
    body: Object,
    meta: Object
});

var Storage = mongoose.model('Storage', storageSchema);

var directorySchema = mongoose.Schema({
    path: String
});

var Directory = mongoose.model('Directory', directorySchema);

// http://stackoverflow.com/a/6969486
function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function simpleLoad(type, path) {
    return when.promise(function(resolve, reject) {
        Storage.findOne(
            { type: type, path: path },
            function (err, storageDocument) {
                if (err) {
                    reject(err);
                }
                if (storageDocument == null) {
                    resolve({});
                } else {
                    if (storageDocument.body) {
                        resolve(storageDocument.body);
                    } else {
                        resolve({});
                    }
                }
            }
        );
    });
}

function simpleSave(type, path, blob) {
    return when.promise(function(resolve, reject) {
        Storage.findOne(
            { type: type, path: path },
            function (err, storageDocument) {
                if (err) {
                    reject(err);
                } else {
                    if (storageDocument == null) {
                        storageDocument = new Storage({type: type, path: path});
                    }

                    storageDocument.body = blob;

                    storageDocument.save(function (err, storageDocument) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }
            }
        );
    });
}

function sortDocumentsIntoPaths(documents) {
    var sorted = {};
    for (var i in documents) {
        var doc = documents[i];
        var p = path.dirname(doc.path);
        if (p == '.') {
            p = '';
        }
        if (!sorted[p]) {
            sorted[p] = [];
        }
        if (p != '') {
            var bits = p.split("/");
            sorted[''].push(bits[0]);
            for (var j = 1; j < bits.length; j++) {
                // Add path to parent path.
                var mat = bits.slice(0, j).join("/");
                if (!sorted[mat]) {
                    sorted[mat] = [];
                }
                sorted[mat].push(bits[j]);
            }
        }
        var meta = doc.meta;
        meta.fn = path.basename(doc.path);
        sorted[p].push(meta);
    }

    return sorted;
}

var mongodb = {
    init: function(_settings) {
        settings = _settings;

        return when.promise(function(resolve, reject) {
            mongoose.connect(settings.mongoUrl);
            var db = mongoose.connection;

            db.on('error', function (err) {
                reject(err);
            });
            db.once('open', function (callback) {
                resolve();
            });
        });
    },

    getFlows: function() {
        return simpleLoad('flows', '/');
    },

    saveFlows: function(flows) {
        return simpleSave('flows', '/', flows);
    },

    getCredentials: function() {
        return simpleLoad('credentials', '/');
    },

    saveCredentials: function(credentials) {
        return simpleSave('credentials', '/', credentials);
    },

    getSettings: function() {
        return simpleLoad('settings', '/');
    },
    saveSettings: function(settings) {
        return simpleSave('settings', '/', settings);
    },
    getSessions: function() {
        return simpleLoad('sessions', '/');
    },
    saveSessions: function(sessions) {
        return simpleSave('sessions', '/', sessions);
    },

    getLibraryEntry: function(type, path) {
        return when.promise(function(resolve, reject) {
            var resolvedType = 'library-' + type;
            Storage.findOne(
                { type: resolvedType, path: path },
                function (err, storageDocument) {
                    if (err) {
                        reject(err);
                    }
                    if (storageDocument != null) {
                        resolve(storageDocument.body);
                    } else {
                        // Probably a directory listing...
                        // Crudely return everything.
                        Storage.find(
                            { type: resolvedType },
                            function (err, storageDocuments) {
                                if (err) {
                                    reject(err);
                                } else {
                                    var result = sortDocumentsIntoPaths(storageDocuments);
                                    resolve(result[path]);
                                }
                            }
                        );
                    }
                }
            );
        });
    },

    saveLibraryEntry: function(type, path, meta, body) {
        return when.promise(function(resolve, reject) {
            var resolvedType = 'library-' + type;
            Storage.findOne(
                { type: resolvedType, path: path },
                function (err, storageDocument) {
                    if (err) {
                        reject(err);
                    } else {
                        if (storageDocument == null) {
                            storageDocument = new Storage({type: resolvedType, path: path});
                        }

                        storageDocument.meta = meta;
                        storageDocument.body = body;

                        storageDocument.save(function (err, storageDocument) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    }
                }
            );
        });

    }
};

module.exports = mongodb;
