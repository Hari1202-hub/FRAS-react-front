import ts from "typescript";
import path from "node:path";

const options = {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
  strict: true, noEmit: true, skipLibCheck: true, allowJs: true, checkJs: false,
  baseUrl: process.cwd(), paths: { "@/*": ["src/*"] },
};
const host = ts.createCompilerHost(options);
// On Windows TypeScript otherwise resolves app.js to the unrelated App.tsx.
host.resolveModuleNames = (names, containingFile) => names.map(name => {
  if (name === "../../app.js") return { resolvedFileName: path.resolve("src/app.js"), extension: ts.Extension.Js };
  return ts.resolveModuleName(name, containingFile, options, host).resolvedModule;
});
const files = ["EditProjectModal", "ProjectTable", "ProjectCardMobile"].map(name => path.resolve(`src/Component_master/components/${name}.tsx`));
const program = ts.createProgram(files, options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
  }));
  process.exit(1);
}
console.log("Project edit components: strict TypeScript check passed.");
