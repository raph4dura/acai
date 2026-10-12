
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

function hashToken(token) {
    return createHash('sha256')
        .update(token)
        .digest('hex');
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');

        return res.status(405).json({
            sucesso: false,
            erro: 'Método não permitido.'
        });
    }

    try {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL não está configurada.');
        }

        const token = req.headers['x-cliente-token'];
        const id = Number(req.body?.id);

        if (
            typeof token !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(token)
        ) {
            return res.status(401).json({
                sucesso: false,
                erro: 'Identificação do cliente inválida.'
            });
        }

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Pedido inválido.'
            });
        }

        const sql = neon(process.env.DATABASE_URL);
        const tokenHash = hashToken(token);

        const resultado = await sql`
            UPDATE pedidos
            SET status = 'cancelado'
            WHERE id = ${id}
              AND cliente_token_hash = ${tokenHash}
              AND status = 'novo'
            RETURNING id, numero_pedido, status
        `;

        if (resultado.length === 0) {
            return res.status(409).json({
                sucesso: false,
                erro: 'Não foi possível cancelar. O pedido pode já estar em preparo ou não pertencer a você.'
            });
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: 'Pedido cancelado com sucesso.',
            pedido: resultado[0]
        });

    } catch (erro) {
        console.error(
            'Erro em api/cancelar-pedido.js:',
            erro.message
        );

        return res.status(500).json({
            sucesso: false,
            erro: 'Não foi possível cancelar o pedido.'
        });
    }
}
