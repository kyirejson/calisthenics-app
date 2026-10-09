# -*- coding: utf-8 -*-
"""
Prisoner Calisthenics: 33 Demon Exercises Biomechanical Graphics Generator Master Runner
Runs Part 1 (Push 1-6, Squat 1-6, Pull 1-6) and Part 2 (LegRaise 1-5, Bridge 1-5, HSPU 1-5).
"""
import sys
import os

from demons_part1 import generate_part1
from demons_part2 import generate_part2

def main():
    print("=== STARTING FULL 33 DEMON EXERCISES GRAPHICS GENERATION ===")
    generate_part1()
    generate_part2()
    print("=== ALL 33 DEMON EXERCISES GRAPHICS SUCCESSFULLY GENERATED! ===")

if __name__ == "__main__":
    main()
