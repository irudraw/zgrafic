export default {
  name: 'Flechas',
  langList: [
    {id: 'arrow_none', textContent: 'Sin flecha'}
  ],
  contextTools: [
    {
      title: 'Seleccionar tipo de flecha',
      options: {
        none: 'Sin flecha',
        end: '----&gt;',
        start: '&lt;----',
        both: '&lt;---&gt;',
        mid: '--&gt;--',
        mid_bk: '--&lt;--'
      }
    }
  ]
};
