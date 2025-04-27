#!/usr/bin/env node

const { parse } = require("@vue/compiler-sfc");
const { baseParse } = require("@vue/compiler-dom");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { program } = require("commander");

program
  .version("1.0.0")
  .argument("<directory>", "Vue files directory")
  .option("-o, --output <output>", "Output JSON file path", "i18n.json")
  .parse(process.argv);

const [inputDir] = program.args;
const options = program.opts();

if (!inputDir) {
  console.error(chalk.red("❌ Vue 파일 디렉토리 경로를 입력하세요."));
  process.exit(1);
}

/**
 * <template> 안에서 {{ 변수 }} 찾는 함수
 */
function extractTemplateVariables(templateContent) {
  const ast = baseParse(templateContent);
  const variables = new Set();

  function traverse(node) {
    if (node.type === 5) {
      // Interpolation ({{ hello }})
      const content = node.content.content.trim();
      if (content) {
        variables.add(content);
      }
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  traverse(ast);

  return Array.from(variables);
}

/**
 * 디렉토리 전체 재귀 스캔 함수
 */
function scanVueFiles(dirPath) {
  const result = {};

  function walk(currentPath) {
    const files = fs.readdirSync(currentPath, { withFileTypes: true });

    files.forEach((file) => {
      const fullPath = path.join(currentPath, file.name);

      if (file.isDirectory()) {
        // 폴더면 재귀 탐색
        walk(fullPath);
      } else if (file.isFile() && path.extname(file.name) === ".vue") {
        // .vue 파일이면 처리
        const fileContent = fs.readFileSync(fullPath, "utf-8");
        const { descriptor } = parse(fileContent);

        if (descriptor.template) {
          const variables = extractTemplateVariables(
            descriptor.template.content
          );
          if (variables.length > 0) {
            const fileName = path
              .relative(inputDir, fullPath)
              .replace(/\\/g, "/")
              .replace(/\.vue$/, "");
            result[fileName] = {};
            variables.forEach((variable) => {
              result[fileName][variable] = "";
            });
          }
        }
      }
    });
  }

  walk(dirPath);

  return result;
}

function main() {
  const dirPath = path.resolve(inputDir);

  if (!fs.existsSync(dirPath)) {
    console.error(chalk.red("❌ 디렉토리를 찾을 수 없습니다."));
    process.exit(1);
  }

  const result = scanVueFiles(dirPath);

  const outputPath = path.resolve(options.output);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(
    chalk.green(
      `✅ ${Object.keys(result).length}개의 컴포넌트에서 변수를 추출했습니다.`
    )
  );
  console.log(chalk.blue(`📄 출력 파일: ${outputPath}`));
}

main();
