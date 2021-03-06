var Mongo = require('../../system/mongo/init.js');

var url = require('url');


var render = function () {
    const isEnglish = /himofei\.com/.test(this.req.headers.host);
    var path;
    if (isEnglish) {
        path = this.jade.proto.router.path.replace(/\.\w+$/, '.en.jade');
    }

    var self = this;
    var page = 0;
    var perPage = 10;
    var skip = 0;

    if (self.reqParam && self.reqParam[1]) {
        page = Math.max(self.reqParam[1] - 1, 0);
        skip = perPage * page;
    }

    Mongo.open(function (db) {
        var collection = db.collection('blog');
        var classCollection = db.collection('blog_class');

        var url_parts = url.parse(self.req.url, true);
        var search = url_parts.search;

        var findquery = {
            "state": {
                $in: ["0", 0, null]
            }
        };
        if (url_parts.query.tags) {
            var newTags = [];
            var tags = url_parts.query.tags.split(',');
            for (var i in tags) {
                newTags.push(tags[i]);
                newTags.push(parseInt(tags[i]));
                newTags.push(new RegExp(tags[i]));
            }
            findquery.classid = {
                $in: newTags
            }
        }

        var data = {
            currentPage: page + 1,
            search: search,
        };

        var getBlogClass = new Promise(function (resolve, reject) {
            classCollection.find({}).toArray(function (err, docs) {
                var blogClass = {};
                for (var i in docs) {
                    blogClass[docs[i].classid] = docs[i];
                    if (isEnglish && blogClass[docs[i].classid]['classname-en']) {
                        blogClass[docs[i].classid].classname = blogClass[docs[i].classid]['classname-en']
                    }
                }
                data.blogClass = blogClass || [];
                resolve();
            });
        });

        var getCount = new Promise(function (resolve, reject) {
            collection.find(findquery).count(function (err, count) {
                data.totalPage = Math.ceil(count / perPage);
                resolve();
            });
        });

        var getBlog = new Promise(function (resolve, reject) {
            collection.find(findquery, {
                limit: perPage,
                skip: skip,
                sort: {
                    pubtime: -1
                }
            }).toArray(function (err, docs) {
                // if(err){
                //     throw new Error(err)
                // }
                // console.log(data.blogs)
                data.blogs = docs || [];
                resolve();
            });
        });

        Promise.all([getBlogClass, getCount, getBlog]).then(function (val) {
            // data.blogs = undefined;
            for (var i in data.blogs) {
                data.blogs[i].tags = [];
                var _class = data.blogs[i].classid;
                var tagIds = '';
                if (typeof (_class) == 'string') {
                    tagIds = [_class]
                } else {
                    tagIds = _class
                }

                for (var j in tagIds) {
                    var ids = tagIds[j].split(',');
                    ids.map(function (item) {
                        data.blogs[i].tags.push({
                            id: item,
                            name: data.blogClass[item] ? data.blogClass[item].classname : ''
                        });
                    });

                }
            }
            self.jade.render({
                data: data,
                path: path
            })
        });
    });
}

exports.get = render;