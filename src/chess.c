#include "chess.h"
#include <stdlib.h>
#include <string.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EXPORT
#endif

static uint8_t g_board[BOARD_SQUARES];
static ChessMove g_moves[MOVE_BUFFER_SIZE];
static uint32_t g_move_count = 0;

static void set_start_position(void) {
    const char *start =
        "rnbqkbnr"
        "pppppppp"
        "................................"
        "PPPPPPPP"
        "RNBQKBNR";

    memset(g_board, '.', sizeof(g_board));

    for (uint8_t i = 0; i < BOARD_SQUARES; ++i) {
        g_board[i] = start[i];
    }
}

static int is_white_piece(char p) {
    return p >= 'A' && p <= 'Z';
}

static int is_black_piece(char p) {
    return p >= 'a' && p <= 'z';
}

static int on_board(int8_t idx) {
    return idx >= 0 && idx < (int8_t)BOARD_SQUARES;
}

EXPORT void chess_reset(void) {
    set_start_position();
    g_move_count = 0;
    srand(42);
}

EXPORT uint8_t *chess_get_board(void) {
    return g_board;
}

static void push_move(uint8_t from, uint8_t to) {
    if (g_move_count >= MOVE_BUFFER_SIZE) {
        return;
    }
    g_moves[g_move_count].from = from;
    g_moves[g_move_count].to = to;
    g_moves[g_move_count].captured = g_board[to];
    g_move_count++;
}

EXPORT ChessMove *chess_get_moves(void) {
    return g_moves;
}

static void generate_pawn_moves(uint8_t idx, uint8_t is_white) {
    int8_t direction = is_white ? -8 : 8;
    int8_t one_step = (int8_t)idx + direction;

    if (on_board(one_step) && g_board[one_step] == '.') {
        push_move(idx, (uint8_t)one_step);
    }

    int8_t attack_left = one_step - 1;
    int8_t attack_right = one_step + 1;

    if (on_board(attack_left) && attack_left % 8 != 7) {
        char target = g_board[attack_left];
        if (target != '.' && ((is_white && is_black_piece(target)) || (!is_white && is_white_piece(target)))) {
            push_move(idx, (uint8_t)attack_left);
        }
    }

    if (on_board(attack_right) && attack_right % 8 != 0) {
        char target = g_board[attack_right];
        if (target != '.' && ((is_white && is_black_piece(target)) || (!is_white && is_white_piece(target)))) {
            push_move(idx, (uint8_t)attack_right);
        }
    }
}

static void generate_knight_moves(uint8_t idx, uint8_t is_white) {
    static const int8_t jumps[] = {17, 15, 10, 6, -17, -15, -10, -6};
    for (uint8_t i = 0; i < sizeof(jumps); ++i) {
        int8_t target = (int8_t)idx + jumps[i];
        if (!on_board(target)) continue;

        int file_diff = abs((target % 8) - (idx % 8));
        int rank_diff = abs((target / 8) - (idx / 8));
        if (!((file_diff == 1 && rank_diff == 2) || (file_diff == 2 && rank_diff == 1))) {
            continue;
        }

        char occupant = g_board[target];
        if (occupant == '.' || (is_white && is_black_piece(occupant)) || (!is_white && is_white_piece(occupant))) {
            push_move(idx, (uint8_t)target);
        }
    }
}

static void generate_king_moves(uint8_t idx, uint8_t is_white) {
    static const int8_t deltas[] = { -9, -8, -7, -1, 1, 7, 8, 9 };
    for (uint8_t i = 0; i < sizeof(deltas); ++i) {
        int8_t target = (int8_t)idx + deltas[i];
        if (!on_board(target)) continue;

        int file_diff = abs((target % 8) - (idx % 8));
        int rank_diff = abs((target / 8) - (idx / 8));
        if (file_diff > 1 || rank_diff > 1) continue;

        char occupant = g_board[target];
        if (occupant == '.' || (is_white && is_black_piece(occupant)) || (!is_white && is_white_piece(occupant))) {
            push_move(idx, (uint8_t)target);
        }
    }
}

static void generate_rook_moves(uint8_t idx, uint8_t is_white) {
    static const int8_t directions[] = { -8, 8, -1, 1 };
    for (uint8_t i = 0; i < sizeof(directions); ++i) {
        uint8_t current = idx;
        while (1) {
            int8_t target = (int8_t)current + directions[i];
            if (!on_board(target)) break;
            if ((directions[i] == -1 || directions[i] == 1) && (target / 8 != current / 8)) break;

            char occupant = g_board[target];
            if (occupant == '.') {
                push_move(idx, (uint8_t)target);
                current = (uint8_t)target;
                continue;
            }

            if ((is_white && is_black_piece(occupant)) || (!is_white && is_white_piece(occupant))) {
                push_move(idx, (uint8_t)target);
            }
            break;
        }
    }
}

static void generate_bishop_moves(uint8_t idx, uint8_t is_white) {
    static const int8_t directions[] = { -9, -7, 7, 9 };
    for (uint8_t i = 0; i < sizeof(directions); ++i) {
        uint8_t current = idx;
        while (1) {
            int8_t target = (int8_t)current + directions[i];
            if (!on_board(target)) break;
            if (abs((target % 8) - (current % 8)) != 1) break;

            char occupant = g_board[target];
            if (occupant == '.') {
                push_move(idx, (uint8_t)target);
                current = (uint8_t)target;
                continue;
            }

            if ((is_white && is_black_piece(occupant)) || (!is_white && is_white_piece(occupant))) {
                push_move(idx, (uint8_t)target);
            }
            break;
        }
    }
}

EXPORT uint32_t chess_generate_moves(uint8_t is_white) {
    g_move_count = 0;
    for (uint8_t idx = 0; idx < BOARD_SQUARES; ++idx) {
        char piece = g_board[idx];
        if (piece == '.') continue;
        if (is_white && !is_white_piece(piece)) continue;
        if (!is_white && !is_black_piece(piece)) continue;

        char normalized = is_white ? piece : (char)(piece - ('a' - 'A'));
        switch (normalized) {
            case 'P':
                generate_pawn_moves(idx, is_white);
                break;
            case 'N':
                generate_knight_moves(idx, is_white);
                break;
            case 'B':
                generate_bishop_moves(idx, is_white);
                break;
            case 'R':
                generate_rook_moves(idx, is_white);
                break;
            case 'K':
                generate_king_moves(idx, is_white);
                break;
            default:
                break;
        }
    }
    return g_move_count;
}

EXPORT uint32_t chess_random_ai(uint8_t is_white) {
    uint32_t moves = chess_generate_moves(is_white);
    if (moves == 0) {
        return 0;
    }
    uint32_t choice = rand() % moves;
    ChessMove mv = g_moves[choice];
    chess_apply_move(mv.from, mv.to);
    return moves;
}

EXPORT int32_t chess_apply_move(uint8_t from, uint8_t to) {
    if (from >= BOARD_SQUARES || to >= BOARD_SQUARES) {
        return -1;
    }

    char moving = g_board[from];
    if (moving == '.') {
        return -2;
    }

    g_board[to] = moving;
    g_board[from] = '.';
    return 0;
}
