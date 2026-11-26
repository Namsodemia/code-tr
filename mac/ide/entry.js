// Code-Tr IDE paketi: CodeMirror 6 + dil destekleri + fflate (zip). build.sh esbuild ile web/vendor/ide/ide.mjs uretir.
export {EditorView, basicSetup} from "codemirror";
export {EditorState, Compartment} from "@codemirror/state";
export {keymap} from "@codemirror/view";
export {indentWithTab} from "@codemirror/commands";
export {html} from "@codemirror/lang-html";
export {css} from "@codemirror/lang-css";
export {javascript} from "@codemirror/lang-javascript";
export {json} from "@codemirror/lang-json";
export {markdown} from "@codemirror/lang-markdown";
export {python} from "@codemirror/lang-python";
export {oneDark} from "@codemirror/theme-one-dark";
export {zipSync, strToU8} from "fflate";
