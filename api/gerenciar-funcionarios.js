
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { exigirDono } from './dono-auth.js';

function hashPin(pin) {
    return createHash('sha256').update(pin).digest('hex');
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (!['GET', 'POST', 'PUT'].includes(req.method)) {
        res.setHeader('Allow', 'GET, POST, PUT');

        return res.status(405).json({
            sucesso: false,
            erro: 'Método não permitido.'
        });
    }

    if (!exigirDono(req, res)) return;

    try {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL não está configurada.');
        }

        const sql = neon(process.env.DATABASE_URL);

        if (req.method === 'GET') {
            const funcionarios = await sql`
                SELECT id, nome, ativo, criado_em
                FROM funcionarios
                ORDER BY ativo DESC, nome ASC
            `;

            return res.status(200).json({
                sucesso: true,
                funcionarios
            });
        }

        const { acao, id, nome, pin } = req.body || {};

        if (req.method === 'POST' && acao === 'cadastrar') {
            const nomeLimpo = typeof nome === 'string'
                ? nome.trim()
                : '';

            if (nomeLimpo.length < 2 || nomeLimpo.length > 100) {
                return res.status(400).json({
                    sucesso: false,
                    erro: 'O nome deve ter entre 2 e 100 caracteres.'
                });
            }

            if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
                return res.status(400).json({
                    sucesso: false,
                    erro: 'O PIN deve conter exatamente 4 números.'
                });
            }

            const hash = hashPin(pin);

            const existente = await sql`
                SELECT id
                FROM funcionarios
                WHERE pin_hash = ${hash}
                  AND ativo = TRUE
                LIMIT 1
            `;

            if (existente.length) {
                return res.status(409).json({
                    sucesso: false,
                    erro: 'Esse PIN já está em uso por outro funcionário ativo.'
                });
            }

            const resultado = await sql`
                INSERT INTO funcionarios (nome, pin_hash, ativo)
                VALUES (${nomeLimpo}, ${hash}, TRUE)
                RETURNING id, nome, ativo, criado_em
            `;

            return res.status(201).json({
                sucesso: true,
                funcionario: resultado[0]
            });
        }

        const funcionarioId = Number(id);

        if (!Number.isInteger(funcionarioId) || funcionarioId < 1) {
            return res.status(400).json({
                sucesso: false,
                erro: 'ID de funcionário inválido.'
            });
        }

        if (req.method === 'POST' && acao === 'desativar') {
            const resultado = await sql`
                UPDATE funcionarios
                SET ativo = FALSE
                WHERE id = ${funcionarioId}
                  AND ativo = TRUE
                RETURNING id, nome, ativo
            `;

            if (!resultado.length) {
                return res.status(404).json({
                    sucesso: false,
                    erro: 'Funcionário não encontrado ou já desativado.'
                });
            }

            return res.status(200).json({
                sucesso: true,
                funcionario: resultado[0]
            });
        }

        if (req.method === 'PUT' && acao === 'alterar_pin') {
            if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
                return res.status(400).json({
                    sucesso: false,
                    erro: 'O novo PIN deve conter exatamente 4 números.'
                });
            }

            const hash = hashPin(pin);

            const existente = await sql`
                SELECT id
                FROM funcionarios
                WHERE pin_hash = ${hash}
                  AND ativo = TRUE
                  AND id <> ${funcionarioId}
                LIMIT 1
            `;

            if (existente.length) {
                return res.status(409).json({
                    sucesso: false,
                    erro: 'Esse PIN já está em uso por outro funcionário ativo.'
                });
            }

            const resultado = await sql`
                UPDATE funcionarios
                SET pin_hash = ${hash}
                WHERE id = ${funcionarioId}
                  AND ativo = TRUE
                RETURNING id, nome, ativo
            `;

            if (!resultado.length) {
                return res.status(404).json({
                    sucesso: false,
                    erro: 'Funcionário não encontrado ou inativo.'
                });
            }

            return res.status(200).json({
                sucesso: true,
                funcionario: resultado[0]
            });
        }

        return res.status(400).json({
            sucesso: false,
            erro: 'Ação inválida.'
        });

    } catch (erro) {
        console.error('Erro em gerenciar-funcionarios.js:', erro);

        return res.status(500).json({
            sucesso: false,
            erro: 'Não foi possível gerenciar os funcionários.'
        });
    }
}
