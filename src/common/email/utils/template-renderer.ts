import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';

const partialsDir = path.join(
  process.cwd(),
  'src/common/email/templates/partials',
);

const templatesDir = path.join(
  process.cwd(),
  'src/common/email/templates/emails',
);

const headerPartial = fs.readFileSync(
  path.join(partialsDir, 'header.hbs'),
  'utf8',
);

const footerPartial = fs.readFileSync(
  path.join(partialsDir, 'footer.hbs'),
  'utf8',
);

handlebars.registerPartial('header', headerPartial);
handlebars.registerPartial('footer', footerPartial);

export function renderTemplate(
  templateName: string,
  context: Record<string, any> = {},
): string {
  const templatePath = path.join(
    templatesDir,
    `${templateName}.hbs`,
  );

  const templateFile = fs.readFileSync(templatePath, 'utf8');

  const compiledTemplate = handlebars.compile(templateFile);

  return compiledTemplate(context);
}