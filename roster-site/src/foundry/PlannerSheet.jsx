import {useEffect,useId,useRef} from 'react';

export function PlannerSheet({open,onClose,title,context,children,footer}) {
  const ref=useRef(null);
  const heading=useRef(null);
  const body=useRef(null);
  const titleId=useId();
  useEffect(()=>{
    const dialog=ref.current;
    if(!open)return;
    const opener=document.activeElement;
    dialog.showModal();
    return ()=>{
      dialog.close();
      if(opener?.isConnected)opener.focus();
    };
  },[open]);
  useEffect(()=>{if(open&&!body.current.contains(document.activeElement))heading.current.focus();},[open,title]);
  return <dialog ref={ref} className="planner-sheet" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="planner-sheet-layout">
      <header className="planner-sheet-header">
        <div className="planner-sheet-grab" aria-hidden="true"/>
        <div className="planner-title-row">
          <h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2>
          <button className="planner-close" type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <p>{context}</p>
      </header>
      <div ref={body} className="planner-sheet-body">{children}</div>
      {footer&&<footer className="planner-sheet-footer">{footer}</footer>}
    </div>
  </dialog>;
}
