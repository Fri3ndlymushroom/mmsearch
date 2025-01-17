const functions = require("firebase-functions");
const https = require('https');
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const cliProgress = require('cli-progress');

db.settings({
    ignoreUndefinedProperties: true,
})


const puppeteer = require('puppeteer')

exports.getPosts = functions.pubsub.schedule("every 1 minutes from 00:00 to 23:59").timeZone("Europe/London").onRun(async (context) => {
    await getPostsNew()
    //await getUserCredibility()
});

exports.getPostsCallable = functions.https.onCall(async (data, context) => {
    //await getPosts()
    await getPostsNew()
    //await getUserCredibility()
});

async function getPostsNew(){

    let response = '';
    let url = 'https://www.reddit.com/r/mechmarket/new.json?sort=new'

    let p = new Promise((resolve, reject) => {
        https.get(url, async (resp) => {

            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                response += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', async () => {

                response = JSON.parse(response)
                await updatePostDatabaseNew(response.data.children)

                //https://www.reddit.com/r/subreddit/new.json?sort=new


                resolve("failed")
            })

        }).on("error", (err) => {
            reject("failed")
            console.log("Error: " + err.message);
        });
    })

    await p.then((message) => {

    })

}

async function updatePostDatabaseNew(newData) {
    let data = []
    newData.forEach(function(post){
        data.push(post.data)
    })


    // get ids that are present in the databse
    let presentIds = []
    await db.collection("postIds").doc("postIds").get().then(doc => {
        if (doc.exists) {
            presentIds = doc.data().ids
        }
    })




    // filter out doublicate ids
    let non_doublicate = 0
    data.forEach(function (post) {
        presentIds.forEach(function (id) {
            if (id === post.id) {
                post.doublicate = true
            }else{
                non_doublicate++
            }
        })
    })

    // push all non doublicate posts to db
    console.log("started")



    let i = 0
    const browser = await puppeteer.launch({
        headless: true
    })
    for (let post of data) {
        if (!post.doublicate) {

            let imagePost = await getImgurLink(browser, post).catch(err => console.log("🛑" + err))
            console.log("got: "+(i+1))

            imagePost.reported = { users: [], broken: false }
            //imagePost.credibility = { found: false, text: "", data: { joined: "", link_karma: 0, comment_karma: 0, trades: 0 } }
            presentIds.push(post.id)

            imagePost = classifyData(imagePost)

            await db.collection("posts").doc(post.id).set(
                imagePost
            )
            i++
        }
    }
    await browser.close()


    let idsListToLong = presentIds.length -100

    if(idsListToLong > 0){
        presentIds.splice(0, idsListToLong)
    }

    await db.collection("postIds").doc("postIds").set({
        ids: presentIds
    })

    console.log("Finished")
}


function classifyData(data) {


    data.classification = {
        search:{
            giveaway: false
        },
        location: "none",
        location_prefix: "none",
        /*
        has: undefined,
        wants: undefined,
        has_title_products: undefined,
        wants_title_products: undefined,
        no_has_wants: undefined,*/
        flair: data.link_flair_text,
        broken: false
    }
    // search

    let text = data.title + data.selftext
    
    if(/giveaway/gim.test(text)){
        data.classification.search.giveaway = true
    }



    // title analysis
    let title = data.title
    title = title.replace(/&amp;/g, "&")
    title = title.replace(/&.*;/g, "")
    data.title = title

    let noHasWants = false
    let specialFlairs = ["Artisan", "Service", "Vendor", "Bulk", "Interest Check", "Group Buy"]
    specialFlairs.forEach(function (flair) {
        if (data.classification.flair === flair) noHasWants = true
    })

    // todo: add exceptoion for ic gb artisain etc...
    let has = title.match(/(?<=\[H\])(.*)(?=\[W\])/g)
    let location = title.match(/(?<=\[)(.*?)(?=\])/g)
    let wants = title.match(/(?<=\[W])(.*)/g)

    if (has === null || location === null || wants === null) {
        data.classification.broken = true
    } else if (data.selftext === "[removed]") {
        data.classification.broken = true
    } else if (location.length === 3 || has.length === 1 || wants.lengt === 1) {
        data.classification.location = location[0]
        data.classification.location_prefix = location[0][0]+location[0][1]
        data.classification.has = has[0]
        data.classification.wants = wants[0]
        data.has_title_products = has[0].split(",")
        data.wants_title_products = wants[0].split(",")
    } else {
        data.classification.broken = true
    }

    if (data.selftext.match(/\[removed\]/gm) !== null) {
        data.classification.borken = true
        return data
    }

    if (noHasWants) {
        data.title = data.title.replace(/^\[(.*?)\]/g, "")
        data.classification.no_has_wants = true
        data.classification.broken = false
        return data
    }


    return data
}


async function getImgurLink(browser, post) {
    // get first imgur link
    let url = post.selftext.match(/http(s*):\/\/imgur\.com.*?(?=\)|$|\])/gm)
    let urls = []
    post.images = []


    if (url !== null) {


        url = url[0]


        const page = await browser.newPage()
        await page.goto(url, {waitUntil: 'networkidle2', timeout: 0})




        function timeout(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        await timeout(100);


        const el = await page.$$("img.image-placeholder")







        await Promise.all(el.map(async (element) => {
            const src = await element.getProperty('src')
            const scrText = await src.jsonValue()

            urls.push(scrText)
        }));


        await page.close();

    }

    let imageLinks = post.selftext.match(/http(s*):\/\/i\.imgur\.com\/.*?(?=\)|$)/gm)
    if (imageLinks !== null)
        imageLinks.forEach(function (element) { urls.push(element) })


    post.images = urls
    return post
}

exports.reportPost = functions.https.onCall(async (data, context) => {

    post = data.document
    user = context.auth.uid
    docData = {}


    await db.collection("posts").doc(post).get().then((doc) => {
        docData = doc.data()
    })

    let alreadyReported = false
    docData.reported.users.forEach(function (element) {
        if (user === element) alreadyReported = true
    })

    if (!alreadyReported) {
        docData.reported.users.push(user)

        if (docData.reported.users.length > 10) {
            docData.reported.broken = true
        }

        db.collection("posts").doc(post).update(docData)
    }
});




// id: pq43ke
// get all comments =  https://api.pushshift.io/reddit/submission/comment_ids/pq43ke

// comment = hdtz6l8 // author needs to be mechkbot
// http://api.pushshift.io/reddit/search/comment/?ids=hdtz6l8


async function getUserCredibility() {
    let postids = []
    await db.collection("posts").where("credibility.found", "==", false).get().then((foundPosts) => {
        foundPosts.forEach(function (post) {
            postids.push(post.data().id)
        })
    })




    for (let id of postids) {


        function timeout(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        await timeout(600);

        let commentids = ""
        https.get("https://api.pushshift.io/reddit/submission/comment_ids/" + id, async (resp) => {
            resp.on('data', (chunk) => {
                commentids += chunk;
            });
            resp.on('end', () => {
                commentids = JSON.parse(commentids)
                getComments(commentids)
            })

        }).on("error", (err) => {
            console.log("Error: " + err.message);
        });
    }
}

function getComments(ids) {
    console.log(ids)
}





