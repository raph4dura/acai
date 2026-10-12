
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({
            sucesso: false,
            erro: 'Método não permitido.'
        });
    }

    try {
        if (!process.env.DATABASE_URL) {
            return res.status(500).json({
                sucesso: false,
                erro: 'DATABASE_URL não está configurada.'
            });
        }

        const sql = neon(process.env.DATABASE_URL);

        // Consulta utilizada pelos painéis administrativos.
        if (req.method === 'GET') {
            const pedidos = await sql`
                SELECT
                    p.*,
                    f.nome AS funcionario_nome
                FROM pedidos p
                LEFT JOIN funcionarios f
                    ON f.id = p.funcionario_id
                ORDER BY p.criado_em DESC NULLS LAST, p.id DESC
            `;

            return res.status(200).json({
                sucesso: true,
                pedidos
            });
        }

        const {
            numero_pedido,
            mesa,
            pagamento,
            observacao,
            total,
            cliente_token
        } = req.body || {};

        const numero = Number(numero_pedido);
        const numeroMesa = Number(mesa);
        const valorTotal = Number(total);

        if (
            !Number.isInteger(numero) || numero < 1 ||
            !Number.isInteger(numeroMesa) || numeroMesa < 1 ||
            !Number.isFinite(valorTotal) || valorTotal < 0
        ) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Número do pedido, mesa ou total inválido.'
            });
        }

        if (
            typeof cliente_token !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(cliente_token)
        ) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Identificação do cliente inválida.'
            });
        }

        const tokenHash = hashToken(cliente_token);

        const resultado = await sql`
            INSERT INTO pedidos (
                numero_pedido,
                mesa,
                status,
                pagamento,
                observacao,
                total,
                criado_em,
                cliente_token_hash
            )
            VALUES (
                ${numero},
                ${numeroMesa},
                'novo',
                ${pagamento || null},
                ${observacao || null},
                ${valorTotal},
                CURRENT_TIMESTAMP,
                ${tokenHash}
            )
            RETURNING *
        `;

        return res.status(201).json({
            sucesso: true,
            pedido: resultado[0]
        });

    } catch (erro) {
        console.error('Erro em api/pedidos.js:', erro.message);

        return res.status(500).json({
            sucesso: false,
            erro: 'Falha ao processar o pedido.'
        });
    }
}
