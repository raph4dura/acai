
import { neon } from '@neondatabase/serverless';
import { createHash, timingSafeEqual } from 'node:crypto';

function hashPin(pin) {
  return createHash('sha256').update(pin).digest('hex');
}

function pinValido(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

function compararHashes(a, b) {
  const hashA = Buffer.from(a, 'hex');
  const hashB = Buffer.from(b, 'hex');

  return hashA.length === hashB.length &&
    timingSafeEqual(hashA, hashB);
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      sucesso: false,
      erro: 'Banco de dados não configurado.'
    });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const funcionarios = await sql`
        SELECT id, nome, ativo
        FROM funcionarios
        ORDER BY nome
      `;

      return res.status(200).json({
        sucesso: true,
        funcionarios
      });
    }

    if (req.method === 'POST') {
      const { acao, nome, pin } = req.body || {};

      if (acao === 'validar_pin') {
        if (!pinValido(pin)) {
          return res.status(400).json({
            sucesso: false,
            erro: 'Digite um PIN de quatro dígitos.'
          });
        }

        const hash = hashPin(pin);

        const resultado = await sql`
          SELECT id, nome
          FROM funcionarios
          WHERE pin_hash = ${hash}
            AND ativo = TRUE
        `;

        if (resultado.length !== 1) {
          return res.status(401).json({
            sucesso: false,
            erro: 'PIN inválido.'
          });
        }

        return res.status(200).json({
          sucesso: true,
          funcionario: resultado[0]
        });
      }

      if (acao === 'cadastrar') {
        if (
          typeof nome !== 'string' ||
          !nome.trim() ||
          !pinValido(pin)
        ) {
          return res.status(400).json({
            sucesso: false,
            erro: 'Informe o nome e um PIN de quatro dígitos.'
          });
        }

        const hash = hashPin(pin);

        const resultado = await sql`
          INSERT INTO funcionarios (nome, pin_hash)
          VALUES (${nome.trim()}, ${hash})
          RETURNING id, nome, ativo
        `;

        return res.status(201).json({
          sucesso: true,
          funcionario: resultado[0]
        });
      }

      return res.status(400).json({
        sucesso: false,
        erro: 'Ação inválida.'
      });
    }

    res.setHeader('Allow', 'GET, POST');

    return res.status(405).json({
      sucesso: false,
      erro: 'Método não permitido.'
    });
  } catch (erro) {
    console.error('Erro em funcionarios.js:', erro);

    return res.status(500).json({
      sucesso: false,
      erro: 'Não foi possível processar os funcionários.'
    });
  }
}
