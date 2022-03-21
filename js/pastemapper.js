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
    padding: 0.25em;
  }
  #pastebox {
    margin-left: 50%;
    transform: translate(-50%);
    width: 100%;
    border: 0px;
    margin-bottom: 0.5em;
  }
  #columns, #data_columns, #data {
    display: grid;
    grid-template-columns: repeat(var(--column-count,auto-fill), minmax(0, 1fr));
    column-gap: 5px;
  }
  #columns label, #data_columns label, #preview_description {
    font-family: 'Helvetica','Verdana',sans-serif;
    font-size: 9pt;
  }

  #preview_description {
    color: #aaa;
  }

  #columns label, #data_columns label {  
    border-radius: 1em;
    background-color: #eee;
    color: #fff;
    padding: 5px;
    text-align: center;
    box-shadow: 3px 3px 3px #ddd;
    overflow: hidden;
    text-overflow: ellipsis;
    border: solid transparent 2px;
    cursor: pointer;
  }
  #data_columns label {
    color: #000;
  }

  #data_columns label.drophover {
    box-shadow: 3px 3px 3px #aaa;
  }

  #columns label[draggable] {
    cursor: grab;
  }

  #columns label[draggable]:active {
    cursor: grabbing;
  }

  #data_columns label span {
    mix-blend-mode: initial;
  }

  #columns label span, #data_columns label span {
    pointer-events: none;
  }

  #columns label span, #data_columns label[style*="background"] span {
    mix-blend-mode: difference;
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
  #data div {
    overflow: hidden;
    text-overflow: ellipsis;
    height: 11pt;
  }
  #data {
    font-family: monospace;
    font-size: 1em;
    text-align: center;
    background-position: top;
    background: repeating-linear-gradient(
      0deg,
      #eee,
      #eee 11pt,
      #fff 11pt,
      #fff 22pt
    );
  }
</style>
<form>
<input id="pastebox" type="search" autocomplete="off" placeholder="Paste data here"/>
<div id="columns"></div>
<div id="data_columns"></div>
<label id="preview_description">Data preview (first 5 rows only)</label>
<div id="data"></div>
</form>
`;

const tmpl_column = document.createElement('template');

tmpl_column.innerHTML = `
  <label draggable="true" class="column"><input name="column" type="radio"/><span></span></label>
`;

const tmpl_data_column = document.createElement('template');

tmpl_data_column.innerHTML = `
  <label class="data_column"><input name="data_column" type="radio"/><span></span></label>
`;

const tmpl_data_item = document.createElement('template');

tmpl_data_item.innerHTML = `
  <div></div>
`;

const paste_to_html_string = (ev) => {
  ev.preventDefault();
  return Promise.resolve(ev.clipboardData.getData('text/html'));
};

const tsv_to_table = (tsv) => {
  return '<table><tr><td>'+tsv.replace(/\n$/,'').replace(/\n/g,'</td></tr><tr><td>').replace(/\t/g,'</td><td>')+'</td></tr></table>';
}

const drop_file_to_html_string = (files) => {
  var reader = new FileReader();
  let file_types = [...files].map( file => file.type );
  let html_idx = file_types.indexOf('text/html');
  let target_idx = file_types.indexOf('text/plain');
  if (html_idx >= 0) {
    target_idx = html_idx;
  }

  let result = new Promise(resolve => {
    reader.onload = function(read) {
      resolve(html_idx < 0 ? tsv_to_table(reader.result) : reader.result);
    }
  });

  reader.readAsText(files[target_idx]);

  return result;
};

const drop_to_html_string = (ev) => {
  ev.preventDefault();
  let files = [...ev.dataTransfer.files];
  let types = [...ev.dataTransfer.types];
  return new Promise( resolve => {
    if (files.length > 0) {
      console.log('Getting from file');
      return drop_file_to_html_string(ev.dataTransfer.files);
    }

    if (types.length > 0) {
      if (types.indexOf('text/html') >= 0) {
        return resolve(ev.dataTransfer.getData('text/html'));
      }
      return resolve(ev.dataTransfer.getData('text/plain'));
    }
    resolve("");
  });
};

const accept_html_table = function(htmlstring) {
  let pastedhtml = (new DOMParser()).parseFromString(htmlstring,'text/html');
  if ( ! pastedhtml ) {
    return false;
  }
  let header = pastedhtml.querySelector('tr');
  if ( ! header ) {
    return;
  }
  let colnames = [...header.querySelectorAll('td')].map( el => el.textContent );
  this.data = [...pastedhtml.querySelectorAll('tr')].map( row => {
    let colvals = [...row.querySelectorAll('td')].map( el => el.textContent );
    let rowdata = {};
    colnames.forEach( (col,idx) => {
      rowdata[col] = colvals[idx];
    });
    return rowdata;
  }).slice(1);
};

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
  this.addEventListener('dragover', ev => {
    ev.preventDefault();
  })
  this.shadowRoot.querySelector('form').addEventListener('drop', async ev => {
    let htmlstring = await drop_to_html_string(ev);
    if (htmlstring.length > 0) {
      accept_html_table.call(this,htmlstring);
    }
  });

  this.shadowRoot.querySelector('form').addEventListener('paste', async ev => {
    let htmlstring = await paste_to_html_string(ev);
    if (htmlstring.length > 0) {
      accept_html_table.call(this,htmlstring);
    }
  });
}

const get_value_for = (form,field) => {
  let matched = form.querySelector(`input[type="radio"][name="${field}"]:checked`);
  if ( ! matched ) {
    return;
  }
  return matched.value;
}

const update_checkmarks = (el) => {
  let col = get_value_for(el.shadowRoot.querySelector('form'),'column');
  let data_col = get_value_for(el.shadowRoot.querySelector('form'),'data_column');
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
  let col = get_value_for(el.shadowRoot.querySelector('form'),'column');
  let data_col = get_value_for(el.shadowRoot.querySelector('form'),'data_column');
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

const colourmap = ['rgba(141,211,199,0.7)',
'rgba(255,255,179,0.7)',
'rgba(190,186,218,0.7)',
'rgba(251,128,114,0.7)',
'rgba(128,177,211,0.7)',
'rgba(253,180,98,0.7)',
'rgba(179,222,105,0.7)',
'rgba(252,205,229,0.7)',
'rgba(217,217,217,0.7)',
'rgba(188,128,189,0.7)',
'rgba(204,235,197,0.7)',
'rgba(255,237,111,0.7)']

const refresh_styles_with_mappings = (el) => {
  let colours = colourmap;
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
      col.querySelector( '[draggable]' )
          .ondragstart = ev => {
            ev.dataTransfer.setData("text/plain", ev.target.querySelector('input').getAttribute('value') );
          }

      col.firstElementChild.firstElementChild.value = colkey;
      col.querySelector('span').appendChild(this.ownerDocument.createTextNode(schema[colkey].description || colkey));
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
      col.querySelector('span').appendChild(this.ownerDocument.createTextNode(colkey));
      col.firstElementChild.ondragover = ev => { ev.target.classList.add('drophover'); ev.preventDefault();}
      col.firstElementChild.ondragleave = ev => {
        ev.target.classList.remove('drophover');
        ev.preventDefault();
      }
      col.firstElementChild.ondrop = ev => {
        let value = ev.dataTransfer.getData('text/plain');
        let form = this.shadowRoot.querySelector('form');
        ev.target.classList.remove('drophover');
        form.querySelector(`input[type="radio"][name="column"][value="${value}"]`).checked = true;
        form.querySelector(`input[type="radio"][name="data_column"][value="${colkey}"]`).checked = true;
        update_mappings(this);
        refresh_styles_with_mappings(this);
      }
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