#!/usr/bin/env perl

# min_bitfinex.pl
# Written by dta90d on 2017.10.28.
#
# Get min order amounts from bitfinex api.

use Modern::Perl '2015';
use autodie;

use JSON;
use LWP::Simple;

use Data::Dumper;

my $JSON = JSON->new->canonical;

my $url          = "https://api.bitfinex.com/v1/symbols_details";
my $fn_coin_dict = "../../data/coin_dict";
    
my @details = @{ decode_json( get $url ) };


# GET COIN DICT.
open my $fh_coin_dict, '<', $fn_coin_dict;
 
my %coin_dict = %{ decode_json( do { local $/; <$fh_coin_dict> } ) };
my @coins     = sort keys %{ $coin_dict{bitfinex} };

close $fh_coin_dict;

my %result;
foreach (@details) {
    my $coin = $_->{pair} =~ tr/a-z/A-Z/r =~ s/^/t/r;
    
    next unless grep {/^$coin$/} @coins;
    $result{bitfinex}{ $coin_dict{bitfinex}{$coin} } = $_->{minimum_order_size} * 1;
}

my $lots = $JSON->encode( \%result );

my $space = ' ' x 4;
$lots =~ s/({|\[|,)/$1\n/g;
$lots =~ s/("\w+":)/$space$1/g;
$lots =~ s/(:)/$1 /g;
$lots =~ s/("\w+_\w+")/$space$1/g;
$lots =~ s/(\])/\n$space$1/g;
$lots =~ s/(})/$space$1/;
$lots =~ s/(\s*})/\n$1/g;
$lots =~ s/(_...")(:)/$1 $2/g;

#open(my $res, '>', '../../data/lots');
say $lots;

#close($res);
