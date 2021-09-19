import React from 'react'

export default function Postpreview({setCurrentOpenPost, currentOpenPost }) {
    if (currentOpenPost.refactored === undefined) {
        currentOpenPost.refactored = { html: "<p></p>" }
    }

    function closePreview(){
        setCurrentOpenPost({refactored:{html:'<p></p>'}})
        console.log("ok")
    }

    return (
        <div id="postpreview">
            {
                getPreview(currentOpenPost, closePreview)
            }
        </div>
    )
}

function getPreview(currentOpenPost, closePreview) {
    if (currentOpenPost.classification)
        if (currentOpenPost.classification.no_has_wants) {
            return (
                <>
                    <button className="button--close" onClick={()=>closePreview()}> &#10006;</button>
                    <h2>{currentOpenPost.title}</h2>
                    <a rel="noreferrer" target="_blank" href={currentOpenPost.full_link}>Full Post</a>
                    <div dangerouslySetInnerHTML={{ __html: currentOpenPost.refactored.html }} />
                </>
            )
        } else {
            return (
                <>
                    <button className="button--close" onClick={()=>closePreview()}>&#10006;</button>
                    <h2>Has: {currentOpenPost.classification.has}</h2>
                    <h2>Wants: {currentOpenPost.classification.wants}</h2>
                    <h3>r/{currentOpenPost.author} from {currentOpenPost.classification.location}</h3>
                    <a rel="noreferrer" target="_blank" href={currentOpenPost.full_link}>Full Post</a>
                    <div dangerouslySetInnerHTML={{ __html: currentOpenPost.refactored.html }} />
                </>
            )
        }
    else {
        return (<>
            <button className="button--close" onClick={()=>closePreview()}>&#10006;</button>
            <div id="postpreview--empty">Click a Post to open<span></span></div>
        </>
        )
    }
}