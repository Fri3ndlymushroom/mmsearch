export default function processPostsData(postsData, settings) {
    // analys e every post
    let processedPostsData = []
    postsData.forEach(function (post) {
        processedPostsData.push(processData(post, settings))
    })

    // filter posts
    for (let i = processedPostsData.length - 1; i >= 0; i--) {
        if (!processedPostsData[i].show) {
            processedPostsData.splice(i, 1);
        }
    }

    // index posts
    processedPostsData.forEach(function (element, y) {
        element.index = y
    })



    return processedPostsData
}


function processData(data, settings) {
    // apply settings
    data = filterPosts(data, settings)
    data = setLinkTarget(data)

    return data
}

function filterPosts(data, settings) {
    data.show = true

    return data
}

function setLinkTarget(data){
    console.log(data.selftext_html)

    data.selftext_html = data.selftext_html.replace(/(?<=;a) /gm, " target='_blank' ")

    return data
}


