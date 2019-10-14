import castWithSchema from 'cast-with-schema';


function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);

let stop_prop = (e) => e.stopPropagation() ;

const change_symb = Symbol('change_timeout');

const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
  }
  #pastebox {
    margin-left: 50%;
    transform: translate(-50%);
    margin-bottom: 0.5em;
  }
  #columns, #data_columns, #data {
    display: grid;
    grid-template-columns: repeat(var(--column-count,auto-fill), minmax(0, 1fr));
    column-gap: 5px;
  }
  #columns label, #data_columns label {
    border-radius: 1em;
    background-color: #eee;
    padding: 5px;
    text-align: center;
    color: #fff;
    box-shadow: 3px 3px 3px #ddd;
    overflow: hidden;
    text-overflow: ellipsis;
    border: solid transparent 2px;
    cursor: pointer;
    font-family: 'Helvetica','Verdana',sans-serif;
    font-size: 9pt;
  }
  #columns, #data_columns {
    margin-bottom: 5px;
  }
  #columns label:focus-within {
    border: solid black 2px;
  }
  label > input {
    position: absolute;
    margin-left: -200vw;
  }
  #data {
    font-family: monospace;
    text-align: center;
  }
</style>
<form>
<input id="pastebox" type="search" autocomplete="off" placeholder="Paste data here"/>
<div id="columns"></div>
<div id="data_columns"></div>
<div id="data"></div>
</form>
`;

const tmpl_column = document.createElement('template');

tmpl_column.innerHTML = `
  <label class="column"><input name="column" type="radio"/></label>
`;

const tmpl_data_column = document.createElement('template');

tmpl_data_column.innerHTML = `
  <label class="data_column"><input name="data_column" type="radio"/></label>
`;

const tmpl_data_item = document.createElement('template');

tmpl_data_item.innerHTML = `
  <div></div>
`;


if (window.ShadyCSS) {
  ShadyCSS.prepareTemplate(tmpl, 'x-pastemapper');
}

const bind_events = function() {
  this.addEventListener('input', (ev) => {
    let select_source = ev.composedPath()[0].name;
    if (select_source === 'data_column') {
      update_mappings(this);
    } else {
      update_checkmarks(this);
    }
    refresh_styles_with_mappings(this);
  });
  this.addEventListener('paste', ev => {
    ev.preventDefault();
    let pastedhtml = (new DOMParser()).parseFromString(ev.clipboardData.getData('text/html'),'text/html');
    if ( ! pastedhtml ) {
      return false;
    }
    let header = pastedhtml.querySelector('tr');
    let colnames = [...header.querySelectorAll('td')].map( el => el.textContent );
    this.data = [...pastedhtml.querySelectorAll('tr')].map( row => {
      let colvals = [...row.querySelectorAll('td')].map( el => el.textContent );
      let rowdata = {};
      colnames.forEach( (col,idx) => {
        rowdata[col] = colvals[idx];
      });
      return rowdata;
    }).slice(1);
  });
}

const update_checkmarks = (el) => {
  let col = el.shadowRoot.querySelector('form').column.value;
  let data_col = el.shadowRoot.querySelector('form').data_column.value;
  if (col && el._mappings[col]) {
    let data_col = el._mappings[col];
    el.shadowRoot.querySelector(`.data_column input[value='${data_col}']`).checked = true;
  } else {
    for (let input of el.shadowRoot.querySelectorAll('.data_column input')) {
      input.checked = false;
    }
  }
};

const update_mappings = (el) => {
  let col = el.shadowRoot.querySelector('form').column.value;
  let data_col = el.shadowRoot.querySelector('form').data_column.value;
  if (col && data_col) {
    for (let key of Object.keys(el._mappings)) {
      if (el._mappings[key] === data_col) {
        delete el._mappings[key];
      }
    }
    el._mappings[col] = data_col;
  }
  for (let input of el.shadowRoot.querySelectorAll('.column input')) {
    input.checked = false;
  }
  let event = new Event('change',{bubbles: true});
  el.dispatchEvent(event);
};

const refresh_styles_with_mappings = (el) => {
  let colours = ['rgba(100,50,50,0.5)','rgba(50,100,50,0.5)','rgba(50,50,100,0.5)'];
  let col_colours = colours.slice();
  let data_col_colours = {};
  for (let col of el.shadowRoot.querySelectorAll(`label.column`)) {
    let curr = col_colours.shift();
    col.style.backgroundColor = curr;
    let colname = col.querySelector('input').value;
    if (el._mappings[colname]) {
      data_col_colours[ el._mappings[colname] ] = curr;
    }
  }
  for (let col of el.shadowRoot.querySelectorAll(`label.data_column`)) {
    let colname = col.querySelector('input').value;
    if ( data_col_colours[ colname ]) {
      col.style.backgroundColor = data_col_colours[ colname ];
    } else {
      col.style.removeProperty('background-color');
    }
  }

};


class PasteMapper extends WrapHTML  {
  static get observedAttributes() {
    return ['template'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    if (window.ShadyCSS) {
      ShadyCSS.styleElement(this);
    }
    let shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(tmpl.content.cloneNode(true));
    bind_events.call(this);
    this._mappings = {};
  }

  get template() {
    return this._schema;
  }

  set template(schema) {


    this._toschema = (object) => {
      return castWithSchema(object,{ type: 'object', properties: schema });
    };

    this._schema = schema;


    for (let col of this.shadowRoot.querySelectorAll('.column')) {
      col.parentNode.removeChild(col);
    }
    let column_parent = this.shadowRoot.querySelector('#columns');
    this.style.setProperty('--column-count',Math.max((this._columns || []).length,Object.keys(this._schema).length));
    for (let colkey of Object.keys(schema)) {
      let col = tmpl_column.content.cloneNode(true);
      col.firstElementChild.firstElementChild.value = colkey;
      col.firstElementChild.appendChild(this.ownerDocument.createTextNode(schema[colkey].description || colkey));
      column_parent.appendChild(col);
    }
    refresh_styles_with_mappings(this);
  }

  get mappedData() {
    return this._data.map( dat => {
      let result = {};
      for (const [key, value] of Object.entries(this._mappings)) {
        result[key] = dat[value].trim();
      }
      return result;
    }).map( obj => this._toschema(obj) );
  }

  get data() {
    return this._data;
  }

  set data(data) {
    this._data = data;
    for (let col of this.shadowRoot.querySelectorAll('.data_column')) {
      col.parentNode.removeChild(col);
    }
    let column_parent = this.shadowRoot.querySelector('#data_columns');
    let autogen_columns = (Array(Object.keys(data[0]).length).fill(1)).map( (val,idx) => { return `Column${idx}` });
    let headers = this.header ? Object.keys(data[0]) : autogen_columns;
    this._columns = headers;
    let col_count = Math.max((this._columns || []).length,Object.keys(this._schema || {}).length);
    this.style.setProperty('--column-count',col_count);
    for (let colkey of headers) {
      let col = tmpl_data_column.content.cloneNode(true);
      col.firstElementChild.firstElementChild.value = colkey;
      col.firstElementChild.appendChild(this.ownerDocument.createTextNode(colkey));
      column_parent.appendChild(col);
    }
    let items_parent = this.shadowRoot.querySelector('#data');
    for (let dat of [...items_parent.children]) {
      items_parent.removeChild(dat);
    }
    for (let row of data.slice(0,5)) {
      for (let i = 0; i < col_count; i++) {
        let colname = headers[i];
        let col = tmpl_data_item.content.cloneNode(true);
        col.firstElementChild.appendChild(this.ownerDocument.createTextNode(row[colname] || ''));
        items_parent.appendChild(col);
      }
    }

    refresh_styles_with_mappings(this);

    let event = new Event('change',{bubbles: true});
    this.dispatchEvent(event);
  }

  attributeChangedCallback(name) {
  }
}

customElements.define('x-pastemapper',PasteMapper);

export default PasteMapper;