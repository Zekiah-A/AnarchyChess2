class RulesetRule extends HTMLElement {
    constructor() {
        super()
    }

    static get observedAttributes() {
        return []
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
    }

    connectedCallback() {
        this.innerHTML = html`
            <span>Rule:</span
        `
    }
}

customElements.define("ac-ruleset-rule", RulesetRule);
