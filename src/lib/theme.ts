// Runs before first paint (inlined in the root layout) so the saved theme never flashes.
export const themeScript = `try{var t=localStorage.getItem("ojt-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
