function defineAndInject(_this, element) {
    element.parentDocument = document
    element.shadowThis = _this
    if (element.id) _this[element.id] = element

    element = element.firstElementChild
    while (element) {
        defineAndInject(_this, element)
        element = element.nextElementSibling
    }
}

function createFromData(name, data) {
    let element = document.createElement(name)
    for (const [key, value] of Object.entries(data)) {
        element.setAttribute(key, value.toString())
    }
    element.connectedCallback()
    return element
}

function html(strings, ...values) {
    return strings.reduce((result, string, i) => {
        const value = values[i] !== undefined ? values[i] : ""
        return result + string + value
    }, "")
}

// Custom implementation of the css function
function css(strings, ...values) {
    return strings.reduce((result, string, i) => {
        const value = values[i] !== undefined ? values[i] : ""
        return result + string + value
    }, "")
}