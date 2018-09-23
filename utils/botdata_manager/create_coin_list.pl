#!/usr/bin/env perl

# create_coin_list.pl
# Written by dta90d on 2017.11.03.

# Help script to create coin list from coin_dict list.

use Modern::Perl;
use JSON;

use Data::Dumper;


my $RES_FILE = $ARGV[0] ? $ARGV[0] : '../../data/coins';

my $output   = JSON->new->canonical;
my $filename = $ARGV[1] ? $ARGV[1] : '../../data/coin_dict';

open(my $coin_dict_file, '<', $filename);

my $buffer;
while(<$coin_dict_file>) {
    $buffer .= $_;
}
close($coin_dict_file);

my $coin_dict = decode_json $buffer;

my %result;
for my $market (sort keys %$coin_dict) {
    
    my @market_coins;
    for my $key (keys %{ $coin_dict->{$market} }) {
        
        my $coin = $coin_dict->{$market}->{$key};
        push @market_coins, $coin;
    }
    
    $result{$market} = [ sort @market_coins ];
}
my $coins = $output->encode( \%result );

my $space = ' ' x 4;
$coins =~ s/(\{|\[|,)/$1\n/g;
$coins =~ s/("\w)/$space$1/g;
$coins =~ s/("\w+_\w+")/$space$1/g;
$coins =~ s/(\])/\n$space$1/g;
$coins =~ s/(\})/\n$1/g;

open(my $res, '>', $RES_FILE);
say $res $coins;

close($res);
